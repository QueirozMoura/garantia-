import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';
import { conflict } from '../utils/http-error.js';
import type { GoogleIdentity } from './google-token.service.js';

/**
 * Vínculo de identidade Google ↔ User (Etapa 4).
 *
 * Esta camada NÃO valida ID Token (isso é do `google-token.service`) e NÃO
 * emite sessão (JWT/cookies ficam para a Etapa 5). Ela apenas resolve QUAL
 * User corresponde a uma identidade Google já verificada — e, no caso de um
 * usuário novo, cria o par User + Account.
 *
 * Fronteira de confiança: a identidade recebida aqui já passou pela verificação
 * de assinatura/issuer/audience/expiração. Ainda assim, os campos são
 * reconferidos defensivamente — nada é aceito por ser "supostamente validado".
 */

/** Provider fixo. Nunca vem do frontend, nunca é parâmetro. */
const GOOGLE_PROVIDER = 'google' as const;

/** Já existe uma conta (com senha) com este email: vincular exige login prévio. */
export class GoogleAccountLinkRequiredError extends Error {
  readonly code = 'GOOGLE_ACCOUNT_LINK_REQUIRED';
  readonly statusCode = 409;

  constructor(
    message = 'Já existe uma conta com este email. Entre com sua senha para vincular o Google.',
  ) {
    super(message);
    this.name = 'GoogleAccountLinkRequiredError';
  }
}

/** Identidade Google inconsistente (sub/email ausente ou email não verificado). */
export class GoogleIdentityInvalidError extends Error {
  constructor(message = 'Google identity is incomplete or unverified') {
    super(message);
    this.name = 'GoogleIdentityInvalidError';
  }
}

/** Usuário público devolvido pelo serviço — mesmo shape de `auth.service`. */
export interface GoogleAuthenticatedUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface GoogleAccountResolution {
  user: GoogleAuthenticatedUser;
  /** true quando User + Account acabaram de ser criados nesta chamada. */
  created: boolean;
}

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  updatedAt: true,
} as const;

const requireNonEmptyString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;

/**
 * Preferência de exibição quando o Google não informa um nome.
 * Determinístico, derivado do próprio email (a parte antes do @) — não inventa
 * informação: não faz title-case, não usa o domínio, não usa o sub.
 */
const fallbackNameFromEmail = (email: string): string => {
  const localPart = email.split('@')[0] ?? '';
  return localPart.length > 0 ? localPart : email;
};

/**
 * Validação defensiva dos campos mínimos, independente do serviço anterior.
 * Lança `GoogleIdentityInvalidError` em vez de devolver algo parcialmente bom.
 */
const assertIdentityUsable = (
  identity: GoogleIdentity,
): { sub: string; email: string; name: string } => {
  const sub = requireNonEmptyString(identity?.sub);
  if (!sub) {
    throw new GoogleIdentityInvalidError('Google identity is missing the subject');
  }

  const email = requireNonEmptyString(identity?.email)?.toLowerCase();
  if (!email || !email.includes('@')) {
    throw new GoogleIdentityInvalidError('Google identity is missing a valid email');
  }

  if (identity.emailVerified !== true) {
    throw new GoogleIdentityInvalidError('Google identity email is not verified');
  }

  const name = requireNonEmptyString(identity.name) ?? fallbackNameFromEmail(email);

  return { sub, email, name };
};

/**
 * Resolve o User correspondente a uma identidade Google verificada.
 *
 * Três cenários:
 * 1. Account google+sub já existe → devolve o User vinculado (nada é criado ou alterado);
 * 2. Account não existe, mas o email já pertence a um User → `GoogleAccountLinkRequiredError`
 *    (nunca vincula por igualdade de email: isso permitiria account takeover);
 * 3. Nem Account nem User existem → cria User + Account numa transação.
 */
export const resolveGoogleAccount = async (
  identity: GoogleIdentity,
): Promise<GoogleAccountResolution> => {
  const { sub, email, name } = assertIdentityUsable(identity);

  const existingAccount = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: { provider: GOOGLE_PROVIDER, providerAccountId: sub },
    },
    select: { user: { select: publicUserSelect } },
  });

  if (existingAccount) {
    return { user: existingAccount.user, created: false };
  }

  // Só o email é consultado — o resultado decide entre "exige vínculo" e
  // "usuário novo", nunca entre "vincula automaticamente" e outra coisa.
  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existingUser) {
    throw new GoogleAccountLinkRequiredError();
  }

  try {
    // User + Account juntos: se um falhar, nenhum permanece.
    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          name,
          email,
          // Conta sem senha: só entra via Google até o usuário definir uma.
          passwordHash: null,
        },
        select: publicUserSelect,
      });

      await tx.account.create({
        data: {
          userId: created.id,
          provider: GOOGLE_PROVIDER,
          providerAccountId: sub,
        },
      });

      return created;
    });

    return { user, created: true };
  } catch (error) {
    // Duas requisições simultâneas para o mesmo sub/email: uma vence a corrida,
    // a outra recebe P2002. Trata-se de forma segura, devolvendo o que já existe
    // em vez de propagar erro ou criar duplicata.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return resolveAfterConcurrentCreate(sub, email);
    }

    throw error;
  }
};

/**
 * Recuperação de corrida: procura primeiro pela Account (mesma identidade) e,
 * caso o vencedor tenha sido o cadastro por senha do mesmo email, exige o
 * vínculo em vez de seguir criando coisa.
 */
const resolveAfterConcurrentCreate = async (
  sub: string,
  email: string,
): Promise<GoogleAccountResolution> => {
  const account = await prisma.account.findUnique({
    where: {
      provider_providerAccountId: { provider: GOOGLE_PROVIDER, providerAccountId: sub },
    },
    select: { user: { select: publicUserSelect } },
  });

  if (account) {
    return { user: account.user, created: false };
  }

  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (user) {
    throw new GoogleAccountLinkRequiredError();
  }

  // Corrida perdida sem registros visíveis: estado inconsistente, melhor falhar
  // do que arriscar inventar dados.
  throw conflict('Could not resolve Google account', 'GOOGLE_ACCOUNT_RESOLUTION_FAILED');
};
