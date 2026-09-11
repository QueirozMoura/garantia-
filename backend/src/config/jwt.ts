import jwt, { type SignOptions } from 'jsonwebtoken';

import { env } from './env.js';

export interface AuthTokenPayload extends jwt.JwtPayload {
  userId: string;
}

export const refreshTokenCookieName = 'refreshToken';

const durationUnits: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export const parseDurationToMs = (value: string): number => {
  const match = /^(\d+)([smhd])$/.exec(value.trim());

  if (!match || !match[1] || !match[2]) {
    const asNumber = Number(value);
    return Number.isFinite(asNumber) ? asNumber : 0;
  }

  const amount = Number(match[1]);
  const unit = durationUnits[match[2]];

  if (unit === undefined) {
    return 0;
  }

  return amount * unit;
};

export const refreshTokenCookieOptions = {
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: 'lax' as const,
  path: '/auth',
  maxAge: parseDurationToMs(env.refreshTokenExpiresIn),
};

const accessTokenOptions: SignOptions = {
  expiresIn: env.accessTokenExpiresIn as SignOptions['expiresIn'],
};

const refreshTokenOptions: SignOptions = {
  expiresIn: env.refreshTokenExpiresIn as SignOptions['expiresIn'],
};

export const createAccessToken = (userId: string): string =>
  jwt.sign({ userId }, env.accessTokenSecret, accessTokenOptions);

export const createRefreshToken = (userId: string): string =>
  jwt.sign({ userId }, env.refreshTokenSecret, refreshTokenOptions);

export const verifyAccessToken = (token: string): AuthTokenPayload =>
  jwt.verify(token, env.accessTokenSecret) as AuthTokenPayload;

export const verifyRefreshToken = (token: string): AuthTokenPayload =>
  jwt.verify(token, env.refreshTokenSecret) as AuthTokenPayload;
