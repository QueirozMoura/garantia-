// Testes unitários da validação de Google ID Token (Etapa 3).
//
// Nenhuma chamada real ao Google: a `google-auth-library` é mockada, então o
// que se prova aqui é o comportamento do NOSSO serviço (issuer, email,
// email_verified, sub, configuração ausente) e a garantia de que o token
// original nunca é devolvido.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const verifyIdToken = vi.fn();

vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    verifyIdToken = verifyIdToken;
  },
}));

// env é controlado por teste para exercitar o caso "sem GOOGLE_CLIENT_ID".
vi.mock('../src/config/env.js', () => ({
  env: { googleClientId: 'client-id-de-teste.apps.googleusercontent.com' },
}));

const { env } = await import('../src/config/env.js');
const {
  verifyGoogleIdToken,
  GoogleTokenInvalidError,
  GoogleEmailNotVerifiedError,
  GoogleAuthNotConfiguredError,
} = await import('../src/services/google-token.service.js');

const envMutavel = env as { googleClientId: string | undefined };

const VALID_CLIENT_ID = 'client-id-de-teste.apps.googleusercontent.com';

/**
 * Faz o mock da biblioteca devolver um ticket com o payload informado — o
 * equivalente a "o Google disse que este token é válido".
 */
const mockValidatedToken = (payload: Record<string, unknown> | undefined) => {
  verifyIdToken.mockResolvedValue({
    getPayload: () => payload,
  });
};

/** Payload completo e legítimo, do qual cada teste remove/estraga uma claim. */
const validPayload = (overrides: Record<string, unknown> = {}) => ({
  iss: 'https://accounts.google.com',
  aud: VALID_CLIENT_ID,
  sub: 'google-sub-123',
  email: 'Mariana@Example.Test',
  email_verified: true,
  name: 'Mariana Silva',
  picture: 'https://example.test/avatar.png',
  exp: Math.floor(Date.now() / 1000) + 3600,
  iat: Math.floor(Date.now() / 1000),
  ...overrides,
});

describe('verifyGoogleIdToken', () => {
  beforeEach(() => {
    verifyIdToken.mockReset();
    envMutavel.googleClientId = VALID_CLIENT_ID;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('token válido retorna a identidade verificada (sem o token original)', async () => {
    mockValidatedToken(validPayload());

    const identity = await verifyGoogleIdToken('id-token-valido');

    expect(identity).toEqual({
      sub: 'google-sub-123',
      // Email normalizado para lowercase.
      email: 'mariana@example.test',
      emailVerified: true,
      name: 'Mariana Silva',
      picture: 'https://example.test/avatar.png',
    });

    // O token original não aparece em NENHUM campo do retorno.
    for (const value of Object.values(identity)) {
      expect(value).not.toBe('id-token-valido');
    }
    expect(JSON.stringify(identity)).not.toContain('id-token-valido');

    // A audiência conferida é exatamente o nosso Client ID.
    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'id-token-valido',
      audience: VALID_CLIENT_ID,
    });
  });

  it('token inválido (biblioteca rejeita a assinatura) é rejeitado', async () => {
    verifyIdToken.mockRejectedValue(new Error('Wrong number of segments in token'));

    await expect(verifyGoogleIdToken('token-forjado')).rejects.toBeInstanceOf(
      GoogleTokenInvalidError,
    );
  });

  it('issuer inválido é rejeitado mesmo com assinatura/audiência válidas', async () => {
    mockValidatedToken(validPayload({ iss: 'https://accounts.evil.test' }));

    await expect(verifyGoogleIdToken('id-token-valido')).rejects.toBeInstanceOf(
      GoogleTokenInvalidError,
    );
  });

  it('aceita o issuer sem esquema (accounts.google.com)', async () => {
    mockValidatedToken(validPayload({ iss: 'accounts.google.com' }));

    await expect(verifyGoogleIdToken('id-token-valido')).resolves.toMatchObject({
      sub: 'google-sub-123',
    });
  });

  it('audience inválida é rejeitada', async () => {
    // A biblioteca rejeita ao conferir a audiência contra o nosso Client ID.
    verifyIdToken.mockRejectedValue(new Error('Audience mismatch'));

    await expect(verifyGoogleIdToken('id-token-de-outro-client')).rejects.toBeInstanceOf(
      GoogleTokenInvalidError,
    );

    expect(verifyIdToken).toHaveBeenCalledWith({
      idToken: 'id-token-de-outro-client',
      audience: VALID_CLIENT_ID,
    });
  });

  it('token expirado é rejeitado', async () => {
    verifyIdToken.mockRejectedValue(new Error('Token used too late'));

    await expect(verifyGoogleIdToken('id-token-expirado')).rejects.toBeInstanceOf(
      GoogleTokenInvalidError,
    );
  });

  it('email não verificado é rejeitado', async () => {
    mockValidatedToken(validPayload({ email_verified: false }));

    await expect(verifyGoogleIdToken('id-token-valido')).rejects.toBeInstanceOf(
      GoogleEmailNotVerifiedError,
    );
  });

  it('email_verified ausente não é aceito como verificado', async () => {
    const payload = validPayload();
    delete (payload as Record<string, unknown>).email_verified;
    mockValidatedToken(payload);

    await expect(verifyGoogleIdToken('id-token-valido')).rejects.toBeInstanceOf(
      GoogleEmailNotVerifiedError,
    );
  });

  it('sub ausente é rejeitado', async () => {
    mockValidatedToken(validPayload({ sub: undefined }));

    await expect(verifyGoogleIdToken('id-token-valido')).rejects.toBeInstanceOf(
      GoogleTokenInvalidError,
    );
  });

  it('sub vazio é rejeitado', async () => {
    mockValidatedToken(validPayload({ sub: '   ' }));

    await expect(verifyGoogleIdToken('id-token-valido')).rejects.toBeInstanceOf(
      GoogleTokenInvalidError,
    );
  });

  it('email ausente é rejeitado', async () => {
    mockValidatedToken(validPayload({ email: undefined }));

    await expect(verifyGoogleIdToken('id-token-valido')).rejects.toBeInstanceOf(
      GoogleTokenInvalidError,
    );
  });

  it('token ausente/vazio não chega a consultar o Google', async () => {
    await expect(verifyGoogleIdToken('')).rejects.toBeInstanceOf(GoogleTokenInvalidError);
    await expect(verifyGoogleIdToken(undefined)).rejects.toBeInstanceOf(GoogleTokenInvalidError);
    await expect(verifyGoogleIdToken(123)).rejects.toBeInstanceOf(GoogleTokenInvalidError);

    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('payload nulo (ticket sem dados) é rejeitado', async () => {
    mockValidatedToken(undefined);

    await expect(verifyGoogleIdToken('id-token-valido')).rejects.toBeInstanceOf(
      GoogleTokenInvalidError,
    );
  });

  it('GOOGLE_CLIENT_ID ausente gera erro de configuração e não valida nada', async () => {
    envMutavel.googleClientId = undefined;

    await expect(verifyGoogleIdToken('id-token-valido')).rejects.toBeInstanceOf(
      GoogleAuthNotConfiguredError,
    );
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('GOOGLE_CLIENT_ID em branco também é tratado como não configurado', async () => {
    envMutavel.googleClientId = '   ';

    await expect(verifyGoogleIdToken('id-token-valido')).rejects.toBeInstanceOf(
      GoogleAuthNotConfiguredError,
    );
    expect(verifyIdToken).not.toHaveBeenCalled();
  });

  it('name/picture ausentes viram null, sem inventar dados', async () => {
    const payload = validPayload();
    delete (payload as Record<string, unknown>).name;
    delete (payload as Record<string, unknown>).picture;
    mockValidatedToken(payload);

    await expect(verifyGoogleIdToken('id-token-valido')).resolves.toEqual({
      sub: 'google-sub-123',
      email: 'mariana@example.test',
      emailVerified: true,
      name: null,
      picture: null,
    });
  });
});
