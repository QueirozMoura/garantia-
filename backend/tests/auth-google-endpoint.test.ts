// Testes HTTP do POST /auth/google — validação do credential + resolução da
// conta + emissão da sessão normal (micro-etapas 5a/5b/5c).
//
// Os DOIS serviços são mockados: NENHUMA chamada real ao Google acontece aqui.
// O que se prova é o contrato do endpoint — body, encadeamento dos serviços,
// erros controlados, sessão emitida no formato do login tradicional e ausência
// de credential/diagnóstico na resposta.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

const verifyGoogleIdToken = vi.fn();
const resolveGoogleAccount = vi.fn();

vi.mock('../src/services/google-token.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/google-token.service.js')>();

  // As classes de erro são REAIS (o controller as usa com `instanceof`); apenas
  // a função de validação é substituída por um mock.
  return {
    ...actual,
    verifyGoogleIdToken,
  };
});

vi.mock('../src/services/google-account.service.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/google-account.service.js')>();

  // Idem: `GoogleAccountLinkRequiredError` precisa ser a classe real para o
  // `instanceof` do controller funcionar.
  return {
    ...actual,
    resolveGoogleAccount,
  };
});

const { GoogleAuthNotConfiguredError, GoogleEmailNotVerifiedError, GoogleTokenInvalidError } =
  await import('../src/services/google-token.service.js');
const { GoogleAccountLinkRequiredError, GoogleIdentityInvalidError } = await import(
  '../src/services/google-account.service.js'
);
const { refreshTokenCookieName, refreshTokenCookieOptions, verifyAccessToken } = await import(
  '../src/config/jwt.js'
);

const { api } = await import('./helpers/http.js');
const { cleanDatabase, disconnectDatabase, testPrisma } = await import('./helpers/db.js');

const REFRESH_COOKIE_NAME = 'refreshToken';

// Extrai os headers Set-Cookie como array de strings cruas.
const setCookieHeaders = (response: { headers: Record<string, unknown> }): string[] => {
  const raw = response.headers['set-cookie'];
  if (Array.isArray(raw)) return raw as string[];
  if (typeof raw === 'string') return [raw];
  return [];
};

// Localiza o cookie de refresh real emitido pelo app.
const findRefreshCookie = (headers: string[]): string | undefined =>
  headers.find((cookie) => cookie.startsWith(`${REFRESH_COOKIE_NAME}=`));

const VALID_IDENTITY = {
  sub: 'google-sub-http-123',
  email: 'convidado@example.test',
  emailVerified: true as const,
  name: 'Convidado HTTP',
  picture: null,
};

const RESOLVED_USER = {
  id: 'user-http-1',
  name: 'Convidado HTTP',
  email: 'convidado@example.test',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('POST /auth/google — credential + resolução de conta', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  // -------------------------------------------------------------------------
  // Body inválido
  // -------------------------------------------------------------------------
  describe('body inválido', () => {
    it('body sem credential retorna VALIDATION_ERROR', async () => {
      verifyGoogleIdToken.mockClear();
      resolveGoogleAccount.mockClear();

      const response = await api().post('/auth/google').send({});

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ path: 'credential' })]),
      );

      // Sem credential válido, NENHUM serviço é consultado.
      expect(verifyGoogleIdToken).not.toHaveBeenCalled();
      expect(resolveGoogleAccount).not.toHaveBeenCalled();
    });

    it('credential vazio retorna VALIDATION_ERROR e não consulta os serviços', async () => {
      verifyGoogleIdToken.mockClear();
      resolveGoogleAccount.mockClear();

      const response = await api().post('/auth/google').send({ credential: '' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(verifyGoogleIdToken).not.toHaveBeenCalled();
      expect(resolveGoogleAccount).not.toHaveBeenCalled();
    });

    it('credential em branco também é rejeitado', async () => {
      verifyGoogleIdToken.mockClear();
      resolveGoogleAccount.mockClear();

      const response = await api().post('/auth/google').send({ credential: '   ' });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(verifyGoogleIdToken).not.toHaveBeenCalled();
      expect(resolveGoogleAccount).not.toHaveBeenCalled();
    });

    it('credential não-string é rejeitado', async () => {
      verifyGoogleIdToken.mockClear();
      resolveGoogleAccount.mockClear();

      const response = await api().post('/auth/google').send({ credential: 12345 });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(verifyGoogleIdToken).not.toHaveBeenCalled();
      expect(resolveGoogleAccount).not.toHaveBeenCalled();
    });

    it('campos extras (email/name/sub) são rejeitados — nunca fonte de identidade', async () => {
      verifyGoogleIdToken.mockClear();
      resolveGoogleAccount.mockClear();

      const response = await api().post('/auth/google').send({
        credential: 'id-token-valido',
        email: 'atacante@example.test',
        name: 'Atacante',
        sub: 'sub-forjado',
      });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(verifyGoogleIdToken).not.toHaveBeenCalled();
      expect(resolveGoogleAccount).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Sucesso
  // -------------------------------------------------------------------------
  describe('resolução bem-sucedida → sessão normal', () => {
    it('account Google existente (created=false) → resposta de login normal', async () => {
      verifyGoogleIdToken.mockResolvedValue(VALID_IDENTITY);
      resolveGoogleAccount.mockResolvedValue({ user: RESOLVED_USER, created: false });

      const response = await api().post('/auth/google').send({ credential: 'id-token-valido' });

      expect(response.status).toBe(200);
      // Mesmo contrato do login tradicional: `{ user, accessToken }`.
      expect(response.body).toEqual({
        user: {
          id: RESOLVED_USER.id,
          name: RESOLVED_USER.name,
          email: RESOLVED_USER.email,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        accessToken: expect.any(String),
      });

      // O credential exato (não o body inteiro) foi repassado ao verificador.
      expect(verifyGoogleIdToken).toHaveBeenCalledTimes(1);
      expect(verifyGoogleIdToken).toHaveBeenCalledWith('id-token-valido');
    });

    it('novo usuário Google (created=true) → resposta de login normal', async () => {
      verifyGoogleIdToken.mockResolvedValue(VALID_IDENTITY);
      resolveGoogleAccount.mockResolvedValue({ user: RESOLVED_USER, created: true });

      const response = await api().post('/auth/google').send({ credential: 'id-token-valido' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        user: {
          id: RESOLVED_USER.id,
          name: RESOLVED_USER.name,
          email: RESOLVED_USER.email,
          createdAt: expect.any(String),
          updatedAt: expect.any(String),
        },
        accessToken: expect.any(String),
      });
    });

    it('emite access token válido (payload { userId }) para o User resolvido', async () => {
      verifyGoogleIdToken.mockResolvedValue(VALID_IDENTITY);
      resolveGoogleAccount.mockResolvedValue({ user: RESOLVED_USER, created: false });

      const response = await api().post('/auth/google').send({ credential: 'id-token-valido' });

      const payload = verifyAccessToken(response.body.accessToken);
      expect(payload.userId).toBe(RESOLVED_USER.id);
    });

    it('emite o cookie de refresh com a MESMA configuração do login tradicional', async () => {
      verifyGoogleIdToken.mockResolvedValue(VALID_IDENTITY);
      resolveGoogleAccount.mockResolvedValue({ user: RESOLVED_USER, created: false });

      const response = await api().post('/auth/google').send({ credential: 'id-token-valido' });

      const refreshCookie = findRefreshCookie(setCookieHeaders(response));
      expect(refreshCookie).toBeDefined();
      expect(refreshCookie).toContain(`${refreshTokenCookieName}=`);
      expect(refreshCookie?.toLowerCase()).toContain('httponly');
      expect(refreshCookie).toContain(`Path=${refreshTokenCookieOptions.path}`);
    });

    it('usa o MESMO emissor de sessão do login tradicional (authService.createSession)', async () => {
      const authService = await import('../src/modules/auth.service.js');
      const spy = vi.spyOn(authService, 'createSession');

      verifyGoogleIdToken.mockResolvedValue(VALID_IDENTITY);
      resolveGoogleAccount.mockResolvedValue({ user: RESOLVED_USER, created: false });

      const response = await api().post('/auth/google').send({ credential: 'id-token-valido' });

      expect(response.status).toBe(200);
      expect(spy).toHaveBeenCalledTimes(1);
      // O User entregue ao emissor é exatamente o resolvido pelo serviço.
      expect(spy.mock.calls[0]?.[0]).toMatchObject({
        id: RESOLVED_USER.id,
        email: RESOLVED_USER.email,
      });

      spy.mockRestore();
    });

    it('o resolveGoogleAccount recebe EXATAMENTE a identidade do verifyGoogleIdToken', async () => {
      verifyGoogleIdToken.mockResolvedValue(VALID_IDENTITY);
      resolveGoogleAccount.mockResolvedValue({ user: RESOLVED_USER, created: false });

      await api().post('/auth/google').send({ credential: 'id-token-valido' });

      expect(resolveGoogleAccount).toHaveBeenCalledTimes(1);
      expect(resolveGoogleAccount).toHaveBeenCalledWith(VALID_IDENTITY);
      // A identidade repassada é o MESMO objeto devolvido pelo verificador —
      // o controller não monta nem enriquece identidade por conta própria.
      const identidadeVerificada = await verifyGoogleIdToken.mock.results[0]?.value;
      expect(resolveGoogleAccount.mock.calls[0]?.[0]).toBe(identidadeVerificada);
      // E nunca o credential bruto.
      expect(resolveGoogleAccount.mock.calls[0]?.[0]).not.toBe('id-token-valido');
    });

    it('o credential original e o sub NUNCA aparecem na resposta', async () => {
      verifyGoogleIdToken.mockResolvedValue(VALID_IDENTITY);
      resolveGoogleAccount.mockResolvedValue({ user: RESOLVED_USER, created: false });

      const credential = 'id-token-secreto-que-nao-pode-vazar';
      const response = await api().post('/auth/google').send({ credential });

      expect(JSON.stringify(response.body)).not.toContain(credential);
      // Nem o sub/identidade completa do Google: só o User resolvido.
      expect(JSON.stringify(response.body)).not.toContain(VALID_IDENTITY.sub);
      expect(response.body.identity).toBeUndefined();

      const refreshCookie = findRefreshCookie(setCookieHeaders(response));
      expect(refreshCookie).not.toContain(credential);
    });

    it('a resposta NÃO contém created, verified nem resolved (nem sub/credential)', async () => {
      verifyGoogleIdToken.mockResolvedValue(VALID_IDENTITY);
      resolveGoogleAccount.mockResolvedValue({ user: RESOLVED_USER, created: true });

      const response = await api().post('/auth/google').send({ credential: 'id-token-valido' });

      expect(response.body.created).toBeUndefined();
      expect(response.body.verified).toBeUndefined();
      expect(response.body.resolved).toBeUndefined();
      expect(response.body.sub).toBeUndefined();
      expect(response.body.credential).toBeUndefined();
      expect(response.body.refreshToken).toBeUndefined();
    });

    it('não cria User nem Account por conta própria (a lógica é do serviço)', async () => {
      verifyGoogleIdToken.mockResolvedValue(VALID_IDENTITY);
      resolveGoogleAccount.mockResolvedValue({ user: RESOLVED_USER, created: false });

      const usersAntes = await testPrisma.user.count();
      const accountsAntes = await testPrisma.account.count();

      const response = await api().post('/auth/google').send({ credential: 'id-token-valido' });

      expect(response.status).toBe(200);
      expect(await testPrisma.user.count()).toBe(usersAntes);
      expect(await testPrisma.account.count()).toBe(accountsAntes);
    });
  });

  // -------------------------------------------------------------------------
  // Erros controlados do serviço
  // -------------------------------------------------------------------------
  describe('erros controlados', () => {
    it('GoogleTokenInvalidError vira 401 controlado (nunca 500)', async () => {
      verifyGoogleIdToken.mockRejectedValue(new GoogleTokenInvalidError());
      resolveGoogleAccount.mockClear();

      const response = await api().post('/auth/google').send({ credential: 'token-forjado' });

      expect(response.status).toBe(401);
      expect(response.body).toEqual({
        error: { message: 'Google credential is invalid', code: 'GOOGLE_TOKEN_INVALID' },
      });
      // Não vaza detalhe interno nem o token.
      expect(JSON.stringify(response.body)).not.toContain('token-forjado');
      // Sem identidade válida, a conta nem é resolvida.
      expect(resolveGoogleAccount).not.toHaveBeenCalled();
      // E nenhuma sessão é criada.
      expect(response.body.accessToken).toBeUndefined();
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('GoogleEmailNotVerifiedError vira 403 controlado', async () => {
      verifyGoogleIdToken.mockRejectedValue(new GoogleEmailNotVerifiedError());
      resolveGoogleAccount.mockClear();

      const response = await api().post('/auth/google').send({ credential: 'id-token-valido' });

      expect(response.status).toBe(403);
      expect(response.body).toEqual({
        error: {
          message: 'Google account email is not verified',
          code: 'GOOGLE_EMAIL_NOT_VERIFIED',
        },
      });
      expect(response.body.verified).toBeUndefined();
      expect(resolveGoogleAccount).not.toHaveBeenCalled();
      // Email não verificado nunca cria sessão.
      expect(response.body.accessToken).toBeUndefined();
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('GoogleAuthNotConfiguredError vira 400 GOOGLE_AUTH_NOT_CONFIGURED', async () => {
      verifyGoogleIdToken.mockRejectedValue(new GoogleAuthNotConfiguredError());
      resolveGoogleAccount.mockClear();

      const response = await api().post('/auth/google').send({ credential: 'id-token-valido' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: {
          message: 'Google sign-in is not configured',
          code: 'GOOGLE_AUTH_NOT_CONFIGURED',
        },
      });
      expect(response.body.verified).toBeUndefined();
      expect(resolveGoogleAccount).not.toHaveBeenCalled();
      // Google não configurado nunca cria sessão.
      expect(response.body.accessToken).toBeUndefined();
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('email já em conta tradicional vira 409 GOOGLE_ACCOUNT_LINK_REQUIRED', async () => {
      verifyGoogleIdToken.mockResolvedValue(VALID_IDENTITY);

      const erro = new GoogleAccountLinkRequiredError();
      resolveGoogleAccount.mockRejectedValue(erro);

      const response = await api().post('/auth/google').send({ credential: 'id-token-valido' });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({
        error: { message: erro.message, code: 'GOOGLE_ACCOUNT_LINK_REQUIRED' },
      });
      // Sem sessão e sem dados de usuário no corpo do erro.
      expect(response.body.accessToken).toBeUndefined();
      expect(response.body.user).toBeUndefined();
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('GoogleIdentityInvalidError vira 401 controlado', async () => {
      verifyGoogleIdToken.mockResolvedValue(VALID_IDENTITY);
      resolveGoogleAccount.mockRejectedValue(new GoogleIdentityInvalidError());

      const response = await api().post('/auth/google').send({ credential: 'id-token-valido' });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('GOOGLE_TOKEN_INVALID');
      expect(response.body.verified).toBeUndefined();
      // Identidade inválida nunca cria sessão.
      expect(response.body.accessToken).toBeUndefined();
      expect(response.headers['set-cookie']).toBeUndefined();
    });

    it('erro inesperado NÃO inventa código novo (segue o error-handler padrão)', async () => {
      verifyGoogleIdToken.mockResolvedValue(VALID_IDENTITY);
      resolveGoogleAccount.mockRejectedValue(new Error('falha inesperada de banco'));

      const response = await api().post('/auth/google').send({ credential: 'id-token-valido' });

      expect(response.status).toBe(500);
      expect(response.body).toEqual({
        error: { message: 'Something went wrong', code: 'INTERNAL_ERROR' },
      });
      // Não vaza detalhe interno.
      expect(JSON.stringify(response.body)).not.toContain('falha inesperada de banco');
    });
  });
});
