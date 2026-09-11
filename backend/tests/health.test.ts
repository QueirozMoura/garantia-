import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api, createUserWithToken } from './helpers/http.js';
import { cleanDatabase, disconnectDatabase } from './helpers/db.js';

// Smoke test for the integration harness: proves that the app boots against the
// dedicated test database and that the auth helper issues a working token.
// The PATCH /documents/:documentId/extraction scenarios are added separately.
describe('integration harness', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  it('rejects requests without an access token', async () => {
    const response = await api().get('/documents/00000-0000-0000-0000-000');
    expect(response.status).toBe(401);
  });

  it('accepts an authenticated request built by the helpers', async () => {
    const { token, user } = await createUserWithToken();
    const response = await api()
      .get('/documents/00000-0000-0000-0000-000')
      .set('Authorization', `Bearer ${token}`);

    // Authenticated but non-existent document: must not be 401.
    expect(response.status).not.toBe(401);
    expect(user.id).toBeTypeOf('string');
  });
});
