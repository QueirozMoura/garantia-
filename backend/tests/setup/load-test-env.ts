import { existsSync } from 'node:fs';
import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

// Load test-only environment variables from backend/.env.test.
// This file is intentionally NOT committed and must NOT be the development .env.
const testEnvPath = resolve(process.cwd(), '.env.test');

if (!existsSync(testEnvPath)) {
  throw new Error(
    'Missing backend/.env.test. Integration tests require a dedicated test database. ' +
      'Create backend/.env.test with at least:\n' +
      '  TEST_DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/garantia_test\n' +
      '  ACCESS_TOKEN_SECRET=<test-only-secret>\n' +
      '  REFRESH_TOKEN_SECRET=<test-only-secret>\n' +
      'Do not reuse the development .env/DATABASE_URL.',
  );
}

loadEnv({ path: testEnvPath, override: true });

const testDatabaseUrl = process.env.TEST_DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL must be defined in backend/.env.test.');
}

// Never run tests against the development database.
const developmentDatabaseUrl = process.env.DATABASE_URL;
if (developmentDatabaseUrl && developmentDatabaseUrl === testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL must not be the same as the development DATABASE_URL.');
}

// The application config (src/config/env.ts) reads DATABASE_URL.
// Point it at the dedicated test database.
process.env.DATABASE_URL = testDatabaseUrl;
process.env.NODE_ENV = 'test';

if (!process.env.ACCESS_TOKEN_SECRET || !process.env.REFRESH_TOKEN_SECRET) {
  throw new Error(
    'ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET must be defined in backend/.env.test.',
  );
}
