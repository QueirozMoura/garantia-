// Testes HTTP do POST /auth/google/link — vínculo do Google a um usuário JÁ
// autenticado.
//
// A validação de ID Token é mockada (NENHUMA chamada real ao Google acontece
// aqui); o restante — requireAuth, controller e linkGoogleAccount — roda de
// verdade contra o BANCO DE TESTE, para provar o comportamento de persistência
// (uma única Account, nada sensível gravado).
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const verifyGoogleIdToken = vi.fn();

vi.mock('../src/services/google-token.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/google-token.service.js')>();

  // As classes de erro são REAIS (o controller as usa com `instanceof`); apenas
  // a função de validação é substituída por um mock.
  return {
    ...actual,
    verifyGoogleIdToken,
  };
});

const { GoogleAuthNotConfiguredError, GoogleEmailNotVerifiedError, GoogleTokenInvalidError } =
  await import('../src/services/google-token.service.js');
const { GoogleIdentityInvalidError } = await import('../src/services/google-account.service.js');

const { api, createUserWithToken } = await import('./helpers/http.js');
const { cleanDatabase, disconnectDatabase, testPrisma } = await import('./helpers/db.js');

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

/** Identidade verificada, como a que sai do google-token.service. */
const identity = (overrides: Partial<Record<string, unknown>> = {}) => ({
  sub: `google-sub-${crypto.randomUUID()}`,
  email: `convidado-${crypto.randomUUID()}@example.test`,
  emailVerified: true as const,
  name: 'Convidado Google',
  picture: 'https://example.test/avatar.png',
  ...overrides,
});

const postLink = (token: string | undefined, body: unknown) => {
  const request = api().post('/auth/google/link');
  if (token) request.set(authHeader(token));
  return request.send(body as object);
};

describe('POST /auth/google/link — vínculo do Google a usuário autenticado', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  beforeEach(async () => {
    verifyGoogleIdToken.mockReset();
    await cleanDatabase();
  });

  // -------------------------------------------------------------------------
  // Autenticação
  // -------------------------------------------------------------------------
  describe('autenticação', () => {
    it('sem Authorization retorna 401 AUTH_REQUIRED e não valida a credencial', async () => {
      const response = await postLink(undefined, { credential: 'id-token-valido' });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_REQUIRED');
      expect(verifyGoogleIdToken).not.toHaveBeenCalled();
    });

    it('token inválido retorna 401 INVALID_ACCESS_TOKEN', async () => {
      const response = await postLink('token-invalido', { credential: 'id-token-valido' });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_ACCESS_TOKEN');
      expect(verifyGoogleIdToken).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Body inválido
  // -------------------------------------------------------------------------
  describe('body inválido', () => {
    it('body sem credential retorna 400 VALIDATION_ERROR', async () => {
      const { token } = await createUserWithToken();

      const response = await postLink(token, {});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(verifyGoogleIdToken).not.toHaveBeenCalled();
    });

    it('credential vazio retorna 400 VALIDATION_ERROR', async () => {
      const { token } = await createUserWithToken();

      const response = await postLink(token, { credential: '' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(verifyGoogleIdToken).not.toHaveBeenCalled();
    });

    it('campo extra no body é rejeitado pelo schema estrito', async () => {
      const { token } = await createUserWithToken();

      const response = await postLink(token, {
        credential: 'id-token-valido',
        email: 'atacante@example.test',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(verifyGoogleIdToken).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Credencial inválida — mesmo tratamento do login Google
  // -------------------------------------------------------------------------
  describe('credencial inválida (mesmo tratamento do login Google)', () => {
    it('GoogleTokenInvalidError vira 401 GOOGLE_TOKEN_INVALID', async () => {
      const { token } = await createUserWithToken();
      verifyGoogleIdToken.mockRejectedValue(new GoogleTokenInvalidError());

      const response = await postLink(token, { credential: 'id-token-valido' });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('GOOGLE_TOKEN_INVALID');
      expect(await testPrisma.account.count()).toBe(0);
    });

    it('GoogleEmailNotVerifiedError vira 403 GOOGLE_EMAIL_NOT_VERIFIED', async () => {
      const { token } = await createUserWithToken();
      verifyGoogleIdToken.mockRejectedValue(new GoogleEmailNotVerifiedError());

      const response = await postLink(token, { credential: 'id-token-valido' });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('GOOGLE_EMAIL_NOT_VERIFIED');
      expect(await testPrisma.account.count()).toBe(0);
    });

    it('GoogleAuthNotConfiguredError vira 400 GOOGLE_AUTH_NOT_CONFIGURED', async () => {
      const { token } = await createUserWithToken();
      verifyGoogleIdToken.mockRejectedValue(new GoogleAuthNotConfiguredError());

      const response = await postLink(token, { credential: 'id-token-valido' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('GOOGLE_AUTH_NOT_CONFIGURED');
      expect(await testPrisma.account.count()).toBe(0);
    });

    it('GoogleIdentityInvalidError vira 401 GOOGLE_TOKEN_INVALID', async () => {
      const { token } = await createUserWithToken();
      verifyGoogleIdToken.mockRejectedValue(new GoogleIdentityInvalidError());

      const response = await postLink(token, { credential: 'id-token-valido' });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('GOOGLE_TOKEN_INVALID');
      expect(await testPrisma.account.count()).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Vinculação bem-sucedida
  // -------------------------------------------------------------------------
  describe('mesmo email', () => {
    it('vincula e retorna 204 sem corpo', async () => {
      const { user, token } = await createUserWithToken();
      const ident = identity({ email: user.email });
      verifyGoogleIdToken.mockResolvedValue(ident);

      const response = await postLink(token, { credential: 'id-token-valido' });

      expect(response.status).toBe(204);
      expect(response.body).toEqual({});

      const accounts = await testPrisma.account.findMany({ where: { userId: user.id } });
      expect(accounts).toHaveLength(1);
      expect(accounts[0]).toMatchObject({
        provider: 'google',
        providerAccountId: ident.sub,
        userId: user.id,
      });
    });

    it('vincula mesmo quando o email difere apenas em caixa', async () => {
      const { user, token } = await createUserWithToken({
        email: `caixa-${crypto.randomUUID()}@example.test`,
      });
      const ident = identity({ email: user.email.toUpperCase() });
      verifyGoogleIdToken.mockResolvedValue(ident);

      const response = await postLink(token, { credential: 'id-token-valido' });

      expect(response.status).toBe(204);
      expect(await testPrisma.account.count()).toBe(1);
    });

    it('não persiste credential, picture, name nem email do Google', async () => {
      const { user, token } = await createUserWithToken();
      const ident = identity({
        email: user.email,
        name: 'Nome Do Google',
        picture: 'https://example.test/avatar-unico.png',
      });
      verifyGoogleIdToken.mockResolvedValue(ident);

      const response = await postLink(token, { credential: 'credential-secreta-nao-persistir' });

      expect(response.status).toBe(204);

      const account = await testPrisma.account.findFirstOrThrow({ where: { userId: user.id } });
      // A Account guarda apenas o vínculo; o JSON não carrega nenhum dado do Google.
      const serialized = JSON.stringify(account);
      expect(serialized).not.toContain('credential-secreta-nao-persistir');
      expect(serialized).not.toContain('avatar-unico.png');
      expect(serialized).not.toContain('Nome Do Google');
      expect(serialized).not.toContain(ident.email);
      // O próprio corpo da resposta não devolve nada disso.
      expect(JSON.stringify(response.body)).not.toContain('credential-secreta-nao-persistir');
    });
  });

  // -------------------------------------------------------------------------
  // Email diferente
  // -------------------------------------------------------------------------
  describe('email diferente', () => {
    it('retorna 403 GOOGLE_ACCOUNT_EMAIL_MISMATCH e não cria Account', async () => {
      const { user, token } = await createUserWithToken();
      verifyGoogleIdToken.mockResolvedValue(identity({ email: 'outro@example.test' }));

      const response = await postLink(token, { credential: 'id-token-valido' });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('GOOGLE_ACCOUNT_EMAIL_MISMATCH');
      const accountCount = await testPrisma.account.count({
        where: { userId: user.id },
      });
      expect(accountCount).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Já vinculado
  // -------------------------------------------------------------------------
  describe('já vinculado', () => {
    it('Google já vinculado ao mesmo usuário retorna 409 e não duplica', async () => {
      const { user, token } = await createUserWithToken();
      const ident = identity({ email: user.email });
      verifyGoogleIdToken.mockResolvedValue(ident);

      const first = await postLink(token, { credential: 'id-token-valido' });
      expect(first.status).toBe(204);

      const second = await postLink(token, { credential: 'id-token-valido' });

      expect(second.status).toBe(409);
      expect(second.body.error.code).toBe('GOOGLE_ACCOUNT_ALREADY_LINKED');
      const accountCount = await testPrisma.account.count({
        where: { userId: user.id },
      });
      expect(accountCount).toBe(1);
    });

    it('usuário já possui outra conta Google vinculada retorna 409', async () => {
      const { user, token } = await createUserWithToken();
      const subAntigo = `google-sub-${crypto.randomUUID()}`;
      await testPrisma.account.create({
        data: { userId: user.id, provider: 'google', providerAccountId: subAntigo },
      });

      // Credencial válida com OUTRO sub, mas mesmo email do usuário.
      verifyGoogleIdToken.mockResolvedValue(
        identity({ email: user.email, sub: `google-sub-${crypto.randomUUID()}` }),
      );

      const response = await postLink(token, { credential: 'id-token-valido' });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('GOOGLE_ACCOUNT_ALREADY_LINKED');
      // Continua apenas a Account antiga — nada de segunda vinculação.
      const accounts = await testPrisma.account.findMany({ where: { userId: user.id } });
      expect(accounts).toHaveLength(1);
      expect(accounts[0]?.providerAccountId).toBe(subAntigo);
    });

    it('Google já vinculado a OUTRO usuário retorna 409', async () => {
      const { user: outro } = await createUserWithToken();
      const sub = `google-sub-${crypto.randomUUID()}`;
      await testPrisma.account.create({
        data: { userId: outro.id, provider: 'google', providerAccountId: sub },
      });

      const { user, token } = await createUserWithToken();
      verifyGoogleIdToken.mockResolvedValue(identity({ email: user.email, sub }));

      const response = await postLink(token, { credential: 'id-token-valido' });

      expect(response.status).toBe(409);
      expect(response.body.error.code).toBe('GOOGLE_ACCOUNT_ALREADY_LINKED');
      const accountCount = await testPrisma.account.count({
        where: { userId: user.id },
      });
      expect(accountCount).toBe(0);
    });
  });
});
