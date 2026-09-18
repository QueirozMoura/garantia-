import type { RequestHandler } from 'express';
import { z } from 'zod';

import { HttpError } from '../utils/http-error.js';
import { refreshTokenCookieName, refreshTokenCookieOptions } from '../config/jwt.js';
import * as authService from './auth.service.js';
import {
  verifyGoogleIdToken,
  GoogleAuthNotConfiguredError,
  GoogleEmailNotVerifiedError,
  GoogleTokenInvalidError,
} from '../services/google-token.service.js';
import {
  resolveGoogleAccount,
  linkGoogleAccount,
  GoogleAccountLinkRequiredError,
  GoogleIdentityInvalidError,
  GoogleAccountEmailMismatchError,
  GoogleAccountAlreadyLinkedError,
} from '../services/google-account.service.js';

/**
 * POST /auth/google — validação do credential + resolução da conta + sessão.
 *
 * Fluxo: credential → verifyGoogleIdToken() → resolveGoogleAccount() →
 * emissão da sessão normal do Garantia+.
 *
 * A sessão NÃO é reimplementada aqui: `authService.createSession` é o MESMO
 * emissor usado pelo login tradicional (mesmos access/refresh token, expiração,
 * secrets e payload), e o cookie de refresh usa exatamente a configuração de
 * `config/jwt` já aplicada em POST /auth/login. O contrato de resposta também é
 * o mesmo do login: `{ user, accessToken }` + cookie de refresh.
 *
 * Ainda não persiste picture nem altera email/passwordHash; o controller não
 * procura User por email, não cria Account manualmente e não faz auto-link: toda
 * a lógica de banco vive no google-account.service.
 *
 * Fronteira de confiança: `credential` é a ÚNICA fonte aceita. Email, name,
 * picture ou sub enviados no body são rejeitados pelo schema, e a identidade
 * usada adiante vem exclusivamente do verifyGoogleIdToken. O credential nunca é
 * devolvido, logado ou incluído em mensagem de erro, e a sessão só é criada a
 * partir do User resolvido pelo google-account.service.
 */

// O body só pode trazer `credential`. O `.strict()` rejeita explicitamente
// tentativas de injetar email/name/sub como "prova" de identidade.
const googleCredentialSchema = z
  .object({
    credential: z.string({ message: 'Credential is required' }).trim().min(1),
  })
  .strict();

/**
 * Erros de configuração/estado são respondidos como 400 (mesmo padrão de
 * AI_PROVIDER_NOT_CONFIGURED): o error-handler mascara qualquer status >= 500
 * como INTERNAL_ERROR, o que esconderia o código real. Nada de 5xx aqui.
 */
const NOT_CONFIGURED = () =>
  new HttpError(400, 'Google sign-in is not configured', 'GOOGLE_AUTH_NOT_CONFIGURED');

const INVALID_TOKEN = () =>
  new HttpError(401, 'Google credential is invalid', 'GOOGLE_TOKEN_INVALID');

const EMAIL_NOT_VERIFIED = () =>
  new HttpError(403, 'Google account email is not verified', 'GOOGLE_EMAIL_NOT_VERIFIED');

/**
 * A mensagem e o código vêm do próprio serviço (nada de auto-link aqui): o
 * controller apenas transporta para HTTP 409.
 */
const accountLinkRequired = (error: GoogleAccountLinkRequiredError) =>
  new HttpError(409, error.message, error.code);

/** Identidade inconsistente vinda do verificador: tratada como credencial ruim. */
const IDENTITY_INVALID = () =>
  new HttpError(401, 'Google credential is invalid', 'GOOGLE_TOKEN_INVALID');

/** Email do Google diferente do email da conta autenticada: vínculo recusado. */
const EMAIL_MISMATCH = () =>
  new HttpError(
    403,
    'The Google account email does not match your account email.',
    'GOOGLE_ACCOUNT_EMAIL_MISMATCH',
  );

/** Google já vinculado (ao próprio usuário ou a outro): nada de segunda Account. */
const ALREADY_LINKED = () =>
  new HttpError(409, 'This Google account is already linked.', 'GOOGLE_ACCOUNT_ALREADY_LINKED');

/**
 * Traduz os erros dos serviços para respostas HTTP controladas. Erros não
 * previstos retornam null e seguem o caminho padrão do projeto (error-handler),
 * sem inventar códigos novos.
 */
const toPublicError = (error: unknown) => {
  if (error instanceof GoogleAuthNotConfiguredError) return NOT_CONFIGURED();
  if (error instanceof GoogleTokenInvalidError) return INVALID_TOKEN();
  if (error instanceof GoogleEmailNotVerifiedError) return EMAIL_NOT_VERIFIED();
  if (error instanceof GoogleAccountLinkRequiredError) return accountLinkRequired(error);
  if (error instanceof GoogleAccountEmailMismatchError) return EMAIL_MISMATCH();
  if (error instanceof GoogleAccountAlreadyLinkedError) return ALREADY_LINKED();
  if (error instanceof GoogleIdentityInvalidError) return IDENTITY_INVALID();
  return null;
};

export const google: RequestHandler = async (request, response, next) => {
  try {
    const { credential } = googleCredentialSchema.parse(request.body);

    // A identidade só existe depois da verificação de assinatura/issuer/
    // audience/expiração feita pelo serviço.
    const identity = await verifyGoogleIdToken(credential);

    // Encontra (ou cria) o User correspondente. A partir daqui a única fonte de
    // identidade para a sessão é este User — nunca dados do body.
    const { user } = await resolveGoogleAccount(identity);

    // Mesma emissão de sessão do login tradicional: access + refresh token,
    // mesmos secrets/expiração/payload. Nada de JWT paralelo para o Google.
    const { accessToken, refreshToken } = authService.createSession(user);

    // Mesmo cookie de refresh do login normal (nome, path, sameSite, secure,
    // maxAge e política prod/dev vêm de config/jwt).
    response.cookie(refreshTokenCookieName, refreshToken, refreshTokenCookieOptions);

    // Contrato idêntico ao do login tradicional: `{ user, accessToken }` + cookie.
    response.json({ user, accessToken });
  } catch (error) {
    next(toPublicError(error) ?? error);
  }
};

/**
 * POST /auth/google/link — vincula o Google a um usuário JÁ autenticado.
 *
 * Fluxo: requireAuth → credential → verifyGoogleIdToken() → linkGoogleAccount().
 *
 * Diferente de POST /auth/google, este endpoint NÃO emite sessão: o usuário já
 * está autenticado e o vínculo é apenas uma nova Account para ele. Reutiliza
 * exatamente a mesma validação de credencial (`verifyGoogleIdToken`), o mesmo
 * shape de erro e a mesma fronteira de confiança: o único dado aceito do body é
 * `credential`, e a identidade usada adiante vem exclusivamente do verificador.
 *
 * A resposta é 204 (sem corpo): nada de credential, token, email ou picture do
 * Google é devolvido ou persistido — só o par (provider=google, sub) é gravado.
 */
export const link: RequestHandler = async (request, response, next) => {
  try {
    // requireAuth já garantiu o userId; aqui ele é apenas lido, nunca do body.
    const userId = request.userId as string;

    const { credential } = googleCredentialSchema.parse(request.body);
    const identity = await verifyGoogleIdToken(credential);

    await linkGoogleAccount(userId, identity);

    response.status(204).end();
  } catch (error) {
    next(toPublicError(error) ?? error);
  }
};
