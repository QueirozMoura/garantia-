// Testes de integração do vínculo Google ↔ User (Etapa 4).
//
// Exercitam o serviço contra o BANCO DE TESTE real, no mesmo padrão das demais
// suítes. Não há HTTP, não há JWT e não há validação de ID Token aqui — o
// serviço recebe uma identidade já verificada, exatamente como em produção.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { cleanDatabase, disconnectDatabase, testPrisma } from './helpers/db.js';
import {
  resolveGoogleAccount,
  GoogleAccountLinkRequiredError,
  GoogleIdentityInvalidError,
} from '../src/services/google-account.service.js';
import type { GoogleIdentity } from '../src/services/google-token.service.js';

/** Identidade verificada, como a que sai do google-token.service. */
const identity = (overrides: Partial<GoogleIdentity> = {}): GoogleIdentity => ({
  sub: `google-sub-${crypto.randomUUID()}`,
  email: `convidado-${crypto.randomUUID()}@example.test`,
  emailVerified: true,
  name: 'Convidado Google',
  picture: 'https://example.test/avatar.png',
  ...overrides,
});

describe('resolveGoogleAccount', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  beforeEach(async () => {
    await cleanDatabase();
  });

  // -------------------------------------------------------------------------
  // Caso 1 — Account Google já existe
  // -------------------------------------------------------------------------
  describe('cenário 1: Account Google já existe', () => {
    it('retorna o User vinculado sem criar nem alterar nada', async () => {
      const primeiro = await resolveGoogleAccount(identity());
      expect(primeiro.created).toBe(true);

      const identidade = (
        await testPrisma.account.findFirstOrThrow({
          where: { userId: primeiro.user.id },
        })
      ).providerAccountId;

      const accountsAntes = await testPrisma.account.count();
      const usuariosAntes = await testPrisma.user.count();

      const segundo = await resolveGoogleAccount(
        identity({
          sub: identidade,
          // Email diferente do cadastrado: NÃO deve ser propagado para o User.
          email: 'outro-email@example.test',
          name: 'Nome Diferente',
        }),
      );

      expect(segundo.created).toBe(false);
      expect(segundo.user.id).toBe(primeiro.user.id);
      expect(segundo.user.email).toBe(primeiro.user.email);

      // Nenhuma Account/User nova e o email original preservado.
      expect(await testPrisma.account.count()).toBe(accountsAntes);
      expect(await testPrisma.user.count()).toBe(usuariosAntes);
      expect(await testPrisma.user.count({ where: { email: 'outro-email@example.test' } })).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Caso 2 — Email já cadastrado (sem Account Google)
  // -------------------------------------------------------------------------
  describe('cenário 2: existe User com o email, mas nenhuma Account Google', () => {
    it('exige vínculo explícito e não cria Account nem altera o User', async () => {
      const email = `com-senha-${crypto.randomUUID()}@example.test`;
      const user = await testPrisma.user.create({
        data: { name: 'Conta Com Senha', email, passwordHash: 'hash-original' },
      });

      await expect(resolveGoogleAccount(identity({ email }))).rejects.toBeInstanceOf(
        GoogleAccountLinkRequiredError,
      );

      // Nada foi vinculado, nada foi alterado — sem takeover por igualdade de email.
      expect(await testPrisma.account.count()).toBe(0);
      const depois = await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(depois.passwordHash).toBe('hash-original');
      expect(depois.email).toBe(email);
      expect(await testPrisma.user.count()).toBe(1);
    });

    it('o erro carrega o código GOOGLE_ACCOUNT_LINK_REQUIRED', async () => {
      const email = `codigo-${crypto.randomUUID()}@example.test`;
      await testPrisma.user.create({ data: { name: 'Existente', email } });

      const erro = await resolveGoogleAccount(identity({ email })).catch((e: unknown) => e);

      expect(erro).toBeInstanceOf(GoogleAccountLinkRequiredError);
      expect((erro as GoogleAccountLinkRequiredError).code).toBe('GOOGLE_ACCOUNT_LINK_REQUIRED');
    });

    it('não vincula nem quando o email difere apenas em caixa', async () => {
      const email = `Caixa-${crypto.randomUUID()}@Example.Test`;
      await testPrisma.user.create({
        data: { name: 'Case', email: email.toLowerCase() },
      });

      await expect(
        resolveGoogleAccount(identity({ email: email.toUpperCase() })),
      ).rejects.toBeInstanceOf(GoogleAccountLinkRequiredError);

      expect(await testPrisma.account.count()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Caso 3 — Usuário novo
  // -------------------------------------------------------------------------
  describe('cenário 3: nem Account nem User existem', () => {
    it('cria User + Account e sinaliza created=true', async () => {
      const identidade = identity();

      const { user, created } = await resolveGoogleAccount(identidade);

      expect(created).toBe(true);
      expect(user.name).toBe(identidade.name);
      expect(user.email).toBe(identidade.email);

      const account = await testPrisma.account.findFirstOrThrow({ where: { userId: user.id } });
      expect(account.provider).toBe('google');
      expect(account.providerAccountId).toBe(identidade.sub);
      expect(account.userId).toBe(user.id);
    });

    it('a Account criada usa provider fixo "google" e exatamente o sub recebido', async () => {
      const sub = 'sub-exato-1234567890';

      const { user } = await resolveGoogleAccount(identity({ sub }));

      const account = await testPrisma.account.findFirstOrThrow({
        where: { userId: user.id },
      });
      expect(account.provider).toBe('google');
      expect(account.providerAccountId).toBe(sub);
    });

    it('normaliza o email do User para lowercase', async () => {
      const { user } = await resolveGoogleAccount(
        identity({ email: 'Convidado.Maiusculo@Example.Test' }),
      );

      expect(user.email).toBe('convidado.maiusculo@example.test');
      expect(
        await testPrisma.user.findUnique({ where: { email: 'convidado.maiusculo@example.test' } }),
      ).not.toBeNull();
    });

    it('o User criado tem passwordHash null', async () => {
      const { user } = await resolveGoogleAccount(identity());

      const persistido = await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(persistido.passwordHash).toBeNull();
    });

    it('usa o name informado pelo Google quando existe', async () => {
      const { user } = await resolveGoogleAccount(identity({ name: 'Ana Beatriz Souza' }));
      expect(user.name).toBe('Ana Beatriz Souza');
    });

    it('name null cai no fallback determinístico (parte antes do @)', async () => {
      const email = `joana.silva-${crypto.randomUUID()}@example.test`;

      const { user } = await resolveGoogleAccount(identity({ email, name: null }));

      expect(user.name).toBe(email.split('@')[0]);
    });

    it('name em branco também cai no fallback', async () => {
      const email = `vazio-${crypto.randomUUID()}@example.test`;

      const { user } = await resolveGoogleAccount(identity({ email, name: '   ' }));

      expect(user.name).toBe(email.split('@')[0]);
    });

    it('picture NÃO é persistido em lugar nenhum', async () => {
      const picture = 'https://example.test/avatar-unico-123.png';

      const { user } = await resolveGoogleAccount(identity({ picture }));

      const persistido = await testPrisma.user.findUniqueOrThrow({ where: { id: user.id } });
      expect(JSON.stringify(persistido)).not.toContain('avatar-unico-123');
      expect(JSON.stringify(user)).not.toContain('avatar-unico-123');

      const account = await testPrisma.account.findFirstOrThrow({ where: { userId: user.id } });
      expect(JSON.stringify(account)).not.toContain('avatar-unico-123');
      expect(Object.keys(account).sort()).toEqual([
        'createdAt',
        'id',
        'provider',
        'providerAccountId',
        'updatedAt',
        'userId',
      ]);
    });
  });

  // -------------------------------------------------------------------------
  // Segurança
  // -------------------------------------------------------------------------
  describe('segurança da identidade recebida', () => {
    it('email não verificado não pode criar conta', async () => {
      await expect(
        resolveGoogleAccount(identity({ emailVerified: false as unknown as true })),
      ).rejects.toBeInstanceOf(GoogleIdentityInvalidError);

      expect(await testPrisma.user.count()).toBe(0);
      expect(await testPrisma.account.count()).toBe(0);
    });

    it('sub vazio é rejeitado sem criar nada', async () => {
      await expect(resolveGoogleAccount(identity({ sub: '   ' }))).rejects.toBeInstanceOf(
        GoogleIdentityInvalidError,
      );

      expect(await testPrisma.account.count()).toBe(0);
    });

    it('email vazio ou sem @ é rejeitado', async () => {
      await expect(resolveGoogleAccount(identity({ email: '' }))).rejects.toBeInstanceOf(
        GoogleIdentityInvalidError,
      );
      await expect(resolveGoogleAccount(identity({ email: 'sem-arroba' }))).rejects.toBeInstanceOf(
        GoogleIdentityInvalidError,
      );

      expect(await testPrisma.user.count()).toBe(0);
    });

    it('a identidade Google não pode criar duas Accounts', async () => {
      const sub = 'sub-repetido-123';

      await resolveGoogleAccount(identity({ sub }));
      const segundo = await resolveGoogleAccount(identity({ sub }));

      expect(segundo.created).toBe(false);
      expect(await testPrisma.account.count({ where: { providerAccountId: sub } })).toBe(1);
    });

    it('providerAccountId diferente representa outra identidade', async () => {
      // Emails diferentes: são duas pessoas distintas, cada uma com seu sub.
      const primeiro = await resolveGoogleAccount(
        identity({ email: `pessoa-a-${crypto.randomUUID()}@example.test`, sub: 'sub-a' }),
      );
      const segundo = await resolveGoogleAccount(
        identity({ email: `pessoa-b-${crypto.randomUUID()}@example.test`, sub: 'sub-b' }),
      );

      // Subs diferentes ⇒ identidades diferentes ⇒ dois Users distintos.
      expect(segundo.user.id).not.toBe(primeiro.user.id);
      expect(await testPrisma.account.count()).toBe(2);
      expect(await testPrisma.user.count()).toBe(2);
    });

    it('mesmo email com sub diferente exige vínculo (não cria segundo User)', async () => {
      // Proteção contra takeover: sub novo não pode "virar" a conta já existente.
      const email = `mesmo-email-${crypto.randomUUID()}@example.test`;

      const primeiro = await resolveGoogleAccount(identity({ email, sub: 'sub-original' }));

      await expect(
        resolveGoogleAccount(identity({ email, sub: 'sub-de-outra-pessoa' })),
      ).rejects.toBeInstanceOf(GoogleAccountLinkRequiredError);

      // Continua existindo apenas o vínculo original.
      expect(await testPrisma.user.count()).toBe(1);
      expect(await testPrisma.account.count()).toBe(1);
      expect(primeiro.created).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Atomicidade
  // -------------------------------------------------------------------------
  describe('atomicidade e concorrência', () => {
    it('falha ao criar a Account desfaz a criação do User (nada parcial)', async () => {
      // Faz o segundo insert (Account) violar a unique composta já existente,
      // forçando a transação a abortar depois que o User foi inserido.
      const sub = 'sub-colisao-123';
      const dono = await testPrisma.user.create({
        data: { name: 'Dono', email: `dono-${crypto.randomUUID()}@example.test` },
      });
      await testPrisma.account.create({
        data: { userId: dono.id, provider: 'google', providerAccountId: sub },
      });

      const emailNovo = `novo-${crypto.randomUUID()}@example.test`;
      const usersAntes = await testPrisma.user.count();

      // Não falha (a Account existente é reaproveitada), mas prova que nenhum
      // User órfão ficou para trás.
      const resultado = await resolveGoogleAccount(identity({ sub, email: emailNovo }));

      expect(resultado.created).toBe(false);
      expect(resultado.user.id).toBe(dono.id);
      expect(await testPrisma.user.count()).toBe(usersAntes);
      expect(await testPrisma.user.count({ where: { email: emailNovo } })).toBe(0);
    });

    it('duas chamadas simultâneas para a mesma identidade não criam duplicata', async () => {
      const identidade = identity();

      const resultados = await Promise.all([
        resolveGoogleAccount(identidade),
        resolveGoogleAccount(identidade),
      ]);

      // Ambos apontam para o MESMO User e existe apenas uma Account.
      expect(resultados[0]?.user.id).toBe(resultados[1]?.user.id);
      expect(await testPrisma.user.count()).toBe(1);
      expect(await testPrisma.account.count()).toBe(1);
      expect(await testPrisma.account.count({ where: { providerAccountId: identidade.sub } })).toBe(
        1,
      );
    });

    it('chamadas simultâneas com mesmo email e subs diferentes não geram inconsistência', async () => {
      const email = `corrida-${crypto.randomUUID()}@example.test`;

      const resultados = await Promise.allSettled([
        resolveGoogleAccount(identity({ email, sub: 'corrida-a' })),
        resolveGoogleAccount(identity({ email, sub: 'corrida-b' })),
      ]);

      // Uma vence a criação; a outra ou é rejeitada (email já usado) ou
      // reaproveita — em nenhum caso sobram Accounts/Users duplicados pelo sub.
      const sucessos = resultados.filter((r) => r.status === 'fulfilled');
      expect(sucessos.length).toBeGreaterThanOrEqual(1);

      for (const sub of ['corrida-a', 'corrida-b']) {
        expect(
          await testPrisma.account.count({ where: { providerAccountId: sub } }),
        ).toBeLessThanOrEqual(1);
      }
      expect(await testPrisma.user.count({ where: { email } })).toBe(1);
    });
  });
});
