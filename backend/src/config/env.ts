import 'dotenv/config';

const port = Number(process.env.PORT ?? 3000);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

const databaseUrl = process.env.DATABASE_URL;
const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;
const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

if (!accessTokenSecret || !refreshTokenSecret) {
  throw new Error('ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET are required');
}

export const env = {
  port,
  nodeEnv: process.env.NODE_ENV ?? 'development',
  clientUrl: process.env.CLIENT_URL ?? 'http://localhost:3000',
  databaseUrl,
  accessTokenSecret,
  refreshTokenSecret,
  accessTokenExpiresIn: process.env.ACCESS_TOKEN_EXPIRES_IN ?? '15m',
  refreshTokenExpiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN ?? '7d',
} as const;
