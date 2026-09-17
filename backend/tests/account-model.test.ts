// Testes de integridade da modelagem Account ↔ User (Etapa 2).
//
// Aqui NÃO existe login Google: apenas as regras do banco. Tudo é exercitado
// contra o banco de teste real via Prisma, no mesmo padrão das demais suítes.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { cleanDatabase, disconnectDatabase, testPrisma } from './helpers/db.js';

const createUser = async () =>
  testPrisma.user.create({
    data: {
      name: 'Usuário Conta',
      email: `conta-${crypto.randomUUID()}@example.test`,
    },
  });

describe('Account — modelagem', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  it('User pode possuir várias Accounts (Google e outro provider)', async () => {
    const user = await createUser();

    const google = await testPrisma.account.create({
      data: { userId: user.id, provider: 'google', providerAccountId: 'sub-google-1' },
    });
    await testPrisma.account.create({
      data: { userId: user.id, provider: 'github', providerAccountId: 'gh-1' },
    });

    const accounts = await testPrisma.account.findMany({ where: { userId: user.id } });
    expect(accounts).toHaveLength(2);

    // A relação inversa também é navegável.
    const withAccounts = await testPrisma.user.findUnique({
      where: { id: user.id },
      include: { accounts: true },
    });
    expect(withAccounts?.accounts.map((a) => a.id)).toContain(google.id);

    // Só o vínculo é persistido: nenhum dado sensível/extra do provedor.
    expect(Object.keys(google).sort()).toEqual([
      'createdAt',
      'id',
      'provider',
      'providerAccountId',
      'updatedAt',
      'userId',
    ]);
    expect(google.createdAt).toBeInstanceOf(Date);
    expect(google.updatedAt).toBeInstanceOf(Date);
  });

  it('Account pertence a um User (relação obrigatória)', async () => {
    const user = await createUser();

    const account = await testPrisma.account.create({
      data: { userId: user.id, provider: 'google', providerAccountId: 'sub-google-2' },
      include: { user: true },
    });

    expect(account.user.id).toBe(user.id);
    expect(account.user.email).toBe(user.email);
  });

  it('rejeita userId inexistente (a FK impede Account órfã)', async () => {
    const orphanUserId = crypto.randomUUID();

    await expect(
      testPrisma.account.create({
        data: { userId: orphanUserId, provider: 'google', providerAccountId: 'sub-orfao' },
      }),
    ).rejects.toThrow();

    expect(await testPrisma.account.count({ where: { userId: orphanUserId } })).toBe(0);
  });

  it('não aceita duplicata de provider + providerAccountId', async () => {
    const user = await createUser();
    const providerAccountId = 'sub-duplicado';

    await testPrisma.account.create({
      data: { userId: user.id, provider: 'google', providerAccountId },
    });

    // Mesma identidade externa, ainda que de outro usuário: deve falhar (P2002).
    const outro = await createUser();
    await expect(
      testPrisma.account.create({
        data: { userId: outro.id, provider: 'google', providerAccountId },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    expect(
      await testPrisma.account.count({ where: { provider: 'google', providerAccountId } }),
    ).toBe(1);

    // O par é o que é único: mesmo providerAccountId em provider diferente é aceito.
    await expect(
      testPrisma.account.create({
        data: { userId: outro.id, provider: 'github', providerAccountId },
      }),
    ).resolves.toMatchObject({ provider: 'github' });
  });

  it('dois usuários podem ter identidades externas diferentes', async () => {
    const primeiro = await createUser();
    const segundo = await createUser();

    await testPrisma.account.create({
      data: { userId: primeiro.id, provider: 'google', providerAccountId: 'sub-a' },
    });
    await testPrisma.account.create({
      data: { userId: segundo.id, provider: 'google', providerAccountId: 'sub-b' },
    });

    const doPrimeiro = await testPrisma.account.findFirst({ where: { userId: primeiro.id } });
    const doSegundo = await testPrisma.account.findFirst({ where: { userId: segundo.id } });

    expect(doPrimeiro?.providerAccountId).toBe('sub-a');
    expect(doSegundo?.providerAccountId).toBe('sub-b');
    expect(doPrimeiro?.id).not.toBe(doSegundo?.id);
  });

  it('excluir o User remove a Account por cascade', async () => {
    const user = await createUser();

    await testPrisma.account.create({
      data: { userId: user.id, provider: 'google', providerAccountId: 'sub-cascade' },
    });
    await testPrisma.account.create({
      data: { userId: user.id, provider: 'github', providerAccountId: 'gh-cascade' },
    });

    await testPrisma.user.delete({ where: { id: user.id } });
    expect(await testPrisma.account.count({ where: { userId: user.id } })).toBe(0);
  });
});
