import { rateLimit } from 'express-rate-limit';
import type { RequestHandler } from 'express';

import { env } from '../config/env.js';

/**
 * Rate limiting reutilizável para proteger endpoints sensíveis contra abuso.
 *
 * - limiters por IP (`loginRateLimiter`/`registerRateLimiter`) nos endpoints
 *   públicos de autenticação;
 * - limiters por usuário autenticado (`extractRateLimiter`,
 *   `assistanceAnalyzeRateLimiter`, `assistanceMessageRateLimiter`), aplicados
 *   DEPOIS do `requireAuth`, para que trocar de IP não contorne o limite.
 *
 * Os limites podem ser ajustados por ambiente via `RATE_LIMIT_AUTH_MAX` e
 * `RATE_LIMIT_AI_MAX` (validados em `config/env.ts`). Quando não definidos:
 * - produção/desenvolvimento usam os valores recomendados (10 e 20);
 * - testes usam um valor alto por padrão, para não quebrar as suítes existentes
 *   que fazem muitas chamadas ao MESMO endpoint. Um teste queira exercitar o
 *   limite define o env var explicitamente antes de importar a app.
 * Isso mantém os valores de produção como padrão e nunca torna a produção mais
 * permissiva por causa da configuração de teste.
 */

const MINUTE = 60 * 1000;
const WINDOW_MS = 15 * MINUTE;

const isTestEnv = env.nodeEnv === 'test';

// Valores recomendados para produção; em teste, o padrão é alto para não
// interferir nas suítes existentes (o env var tem precedência).
const AUTH_MAX = env.rateLimitAuthMax ?? (isTestEnv ? 1000 : 10);
const AI_MAX = env.rateLimitAiMax ?? (isTestEnv ? 1000 : 20);

/** Corpo 429 no mesmo formato `{ error: { code, message }` do projeto. */
const rateLimitMessage = {
  error: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Muitas tentativas. Tente novamente mais tarde.',
  },
} as const;

// Não vaza detalhes internos nem stack trace.
const handler: RequestHandler = (_request, response) => {
  response.status(429).json(rateLimitMessage);
};

/**
 * Limiter por IP para endpoints públicos de autenticação (login/register).
 *
 * Não usa autenticação: a chave é o IP do cliente resolvido pelo Express.
 * Cada rota recebe uma INSTÂNCIA própria (portanto um contador próprio),
 * para que login e register tenham orçamentos independentes.
 */
const createIpRateLimiter = () =>
  rateLimit({
    windowMs: WINDOW_MS,
    limit: AUTH_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler,
    message: rateLimitMessage,
  });

/** Limiter por IP do POST /auth/login. */
export const loginRateLimiter = createIpRateLimiter();

/** Limiter por IP do POST /auth/register. */
export const registerRateLimiter = createIpRateLimiter();

/**
 * Cria um limiter por usuário autenticado para um endpoint que consome IA.
 *
 * Deve ser montado DEPOIS do `requireAuth`, pois usa `request.userId` (definido
 * pelo middleware de autenticação) como chave. O `userId` vem exclusivamente do
 * token verificado — nunca do body/query/header enviados pelo cliente.
 *
 * Cada endpoint recebe a sua própria instância, ou seja, cada um tem um
 * orçamento independente por usuário.
 */
const createAiRateLimiter = () =>
  rateLimit({
    windowMs: WINDOW_MS,
    limit: AI_MAX,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    // Chave por usuário autenticado; ignora o IP para não permitir contorno
    // trocando de IP. Se, por algum motivo, `userId` estiver ausente (o limiter
    // sempre é montado após o requireAuth), cai de volta para o IP.
    keyGenerator: (request) => request.userId ?? request.ip ?? 'unknown',
    // A chave primária é o userId, não o IP: desabilita a validação/aviso de
    // fallback de IP do IPv6 do express-rate-limit.
    validate: { keyGeneratorIpFallback: false },
    handler,
    message: rateLimitMessage,
  });

/** Limiter por usuário autenticado do POST /documents/:documentId/extract. */
export const extractRateLimiter = createAiRateLimiter();

/** Limiter por usuário autenticado do POST .../assistance/analyze. */
export const assistanceAnalyzeRateLimiter = createAiRateLimiter();

/** Limiter por usuário autenticado do POST .../assistance/message. */
export const assistanceMessageRateLimiter = createAiRateLimiter();
