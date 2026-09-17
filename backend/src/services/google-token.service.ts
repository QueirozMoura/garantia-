import { OAuth2Client, type TokenPayload } from 'google-auth-library';

import { env } from '../config/env.js';

/**
 * Validação de Google ID Tokens (Etapa 3).
 *
 * Esta camada NÃO autentica ninguém: ela apenas responde "este ID Token é
 * autêntico e foi emitido pelo Google para o nosso Client ID?". Quem encontra
 * ou cria o usuário, e quem emite a sessão JWT, é a Etapa 4.
 *
 * Regras de segurança que este módulo garante:
 * - a assinatura é verificada pela própria `google-auth-library` contra as
 *   chaves públicas do Google (JWKS). O payload NUNCA é lido antes disso;
 * - `aud` precisa ser exatamente o nosso GOOGLE_CLIENT_ID;
 * - `iss` precisa ser um dos emissores oficiais do Google;
 * - expiração é checada pela biblioteca (`exp`/`iat`, com skew);
 * - `sub`, `email` e `email_verified` são obrigatórios e vêm SOMENTE do token
 *   já verificado. Nada é aceito do body/header enviados pelo cliente;
 * - o token original nunca é devolvido, logado ou armazenado.
 */

/** Emissores oficiais aceitos (contas Google e Google Workspace). */
const GOOGLE_ISSUERS = new Set(['accounts.google.com', 'https://accounts.google.com']);

/** Identidade verificada do provedor — o mínimo para a próxima etapa. */
export interface GoogleIdentity {
  sub: string;
  email: string;
  emailVerified: true;
  name: string | null;
  picture: string | null;
}

/** Token ausente/malformado: o cliente não enviou algo verificável. */
export class GoogleTokenInvalidError extends Error {
  constructor(message = 'Google ID token is invalid') {
    super(message);
    this.name = 'GoogleTokenInvalidError';
  }
}

/** O ID Token é autêntico, mas o email do Google não está verificado. */
export class GoogleEmailNotVerifiedError extends Error {
  constructor(message = 'Google account email is not verified') {
    super(message);
    this.name = 'GoogleEmailNotVerifiedError';
  }
}

/** GOOGLE_CLIENT_ID ausente: não há como validar a audiência. */
export class GoogleAuthNotConfiguredError extends Error {
  constructor(message = 'Google sign-in is not configured') {
    super(message);
    this.name = 'GoogleAuthNotConfiguredError';
  }
}

// Cliente único e sem credenciais: verifyIdToken só precisa das chaves públicas
// do Google, então nenhum Client Secret é usado nem armazenado aqui.
const oauthClient = new OAuth2Client();

const requireNonEmptyString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value : null;

/**
 * Valida o ID Token e devolve a identidade verificada.
 *
 * Lança `GoogleAuthNotConfiguredError`, `GoogleTokenInvalidError` ou
 * `GoogleEmailNotVerifiedError` — nunca devolve dados parcialmente confiáveis.
 */
export const verifyGoogleIdToken = async (idToken: unknown): Promise<GoogleIdentity> => {
  const clientId = env.googleClientId?.trim();

  if (!clientId) {
    throw new GoogleAuthNotConfiguredError();
  }

  const token = requireNonEmptyString(idToken);
  if (!token) {
    throw new GoogleTokenInvalidError('Google ID token is required');
  }

  let payload: TokenPayload | undefined;

  try {
    // Verifica assinatura (JWKS), emissor, audiência e expiração.
    const ticket = await oauthClient.verifyIdToken({
      idToken: token,
      audience: clientId,
    });
    payload = ticket.getPayload();
  } catch {
    // Erro da biblioteca não é vazado: expõe apenas que o token é inválido.
    throw new GoogleTokenInvalidError();
  }

  if (!payload) {
    throw new GoogleTokenInvalidError();
  }

  // O emissor é reconferido explicitamente: a audiência por si só não garante
  // que o token veio de uma conta Google.
  if (!payload.iss || !GOOGLE_ISSUERS.has(payload.iss)) {
    throw new GoogleTokenInvalidError('Google ID token has an unexpected issuer');
  }

  const sub = requireNonEmptyString(payload.sub);
  if (!sub) {
    throw new GoogleTokenInvalidError('Google ID token is missing the subject');
  }

  const email = requireNonEmptyString(payload.email);
  if (!email) {
    throw new GoogleTokenInvalidError('Google ID token is missing the email');
  }

  if (payload.email_verified !== true) {
    throw new GoogleEmailNotVerifiedError();
  }

  return {
    sub,
    email: email.toLowerCase(),
    emailVerified: true,
    name: requireNonEmptyString(payload.name),
    picture: requireNonEmptyString(payload.picture),
  };
};
