import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';

import { prisma } from '../config/prisma.js';
import { createAccessToken, createRefreshToken, verifyRefreshToken } from '../config/jwt.js';
import { conflict, notFound, unauthorized } from '../utils/http-error.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  createdAt: true,
  updatedAt: true,
} as const;

export const register = async (input: RegisterInput) => {
  const passwordHash = await bcrypt.hash(input.password, 12);

  try {
    return await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
      },
      select: publicUserSelect,
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw conflict('Email is already registered', 'EMAIL_ALREADY_REGISTERED');
    }

    throw error;
  }
};

export const login = async (input: LoginInput) => {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  if (!user?.passwordHash || !(await bcrypt.compare(input.password, user.passwordHash))) {
    throw unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
  }

  return createSession(user);
};

/**
 * Usuário autenticável mínimo aceito pelo emissor de sessão. No caso do Google
 * o User vem de `google-account.service`, que já devolve exatamente o shape
 * público (id/name/email/createdAt/updatedAt).
 */
interface SessionUser {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Único ponto de emissão de sessão do projeto. Login tradicional e login Google
 * passam por aqui: mesma geração de access/refresh token, mesma expiração,
 * mesmos secrets e mesmo payload (ver `config/jwt`). Nenhuma cópia paralela de
 * JWT é criada para o Google.
 */
export const createSession = (user: SessionUser) => ({
  user: {
    id: user.id,
    name: user.name,
    email: user.email,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  },
  accessToken: createAccessToken(user.id),
  refreshToken: createRefreshToken(user.id),
});

export const refresh = (token: string) => {
  let payload;

  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw unauthorized('Invalid or expired refresh token', 'INVALID_REFRESH_TOKEN');
  }

  if (typeof payload.userId !== 'string') {
    throw unauthorized('Invalid refresh token', 'INVALID_REFRESH_TOKEN');
  }

  return createAccessToken(payload.userId);
};

export const getMe = async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: publicUserSelect,
  });

  if (!user) {
    throw notFound('User not found', 'USER_NOT_FOUND');
  }

  return user;
};
