import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api, createUserWithToken } from './helpers/http.js';
import { cleanDatabase, disconnectDatabase } from './helpers/db.js';

// A body that passes updatePurchaseSchema, so PUT tests isolate the :id validation.
const validUpdateBody = { productName: 'Produto atualizado' };

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const invalidIds = ['not-a-uuid', '123', '550e8400-e29b-41d4-a716-44665544000'];

describe('Validação de :id nas rotas de purchases', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  describe('ID inválido retorna 400 INVALID_PURCHASE_ID', () => {
    for (const invalidId of invalidIds) {
      it(`GET /purchases/${invalidId} → 400`, async () => {
        const { token } = await createUserWithToken();

        const response = await api().get(`/purchases/${invalidId}`).set(auth(token));

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: {
            message: 'Invalid purchase ID',
            code: 'INVALID_PURCHASE_ID',
          },
        });
      });

      it(`PUT /purchases/${invalidId} → 400`, async () => {
        const { token } = await createUserWithToken();

        const response = await api()
          .put(`/purchases/${invalidId}`)
          .set(auth(token))
          .send(validUpdateBody);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: {
            message: 'Invalid purchase ID',
            code: 'INVALID_PURCHASE_ID',
          },
        });
      });

      it(`DELETE /purchases/${invalidId} → 400`, async () => {
        const { token } = await createUserWithToken();

        const response = await api().delete(`/purchases/${invalidId}`).set(auth(token));

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: {
            message: 'Invalid purchase ID',
            code: 'INVALID_PURCHASE_ID',
          },
        });
      });
    }
  });

  describe('UUID válido inexistente continua retornando 404', () => {
    it('GET /purchases/<uuid inexistente> → 404 PURCHASE_NOT_FOUND', async () => {
      const { token } = await createUserWithToken();

      const response = await api().get(`/purchases/${crypto.randomUUID()}`).set(auth(token));

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: {
          message: 'Purchase not found',
          code: 'PURCHASE_NOT_FOUND',
        },
      });
    });

    it('PUT /purchases/<uuid inexistente> → 404 PURCHASE_NOT_FOUND', async () => {
      const { token } = await createUserWithToken();

      const response = await api()
        .put(`/purchases/${crypto.randomUUID()}`)
        .set(auth(token))
        .send(validUpdateBody);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: {
          message: 'Purchase not found',
          code: 'PURCHASE_NOT_FOUND',
        },
      });
    });

    it('DELETE /purchases/<uuid inexistente> → 404 PURCHASE_NOT_FOUND', async () => {
      const { token } = await createUserWithToken();

      const response = await api().delete(`/purchases/${crypto.randomUUID()}`).set(auth(token));

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: {
          message: 'Purchase not found',
          code: 'PURCHASE_NOT_FOUND',
        },
      });
    });
  });

  it('sem token continua retornando 401, mesmo com ID inválido', async () => {
    // The id validation runs inside the authenticated handler, so an
    // unauthenticated request is still rejected with 401 first.
    const response = await api().get('/purchases/not-a-uuid');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      },
    });
  });
});
