import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api, createUserWithToken } from './helpers/http.js';
import { cleanDatabase, disconnectDatabase, testPrisma } from './helpers/db.js';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

const invalidIds = ['not-a-uuid', '123', '550e8400-e29b-41d4-a716-44665544000'];

const validWarrantyBody = {
  durationMonths: 12,
  startDate: '2024-01-01',
  endDate: '2025-01-01',
};

const createPurchase = async (userId: string) =>
  testPrisma.purchase.create({
    data: {
      userId,
      productName: 'Produto',
      purchaseDate: new Date('2024-01-01T00:00:00.000Z'),
      price: '100.00',
      category: 'Eletrônicos',
    },
  });

const createWarranty = async (purchaseId: string) =>
  testPrisma.warranty.create({
    data: {
      purchaseId,
      durationMonths: 12,
      startDate: new Date('2024-01-01T00:00:00.000Z'),
      endDate: new Date('2025-01-01T00:00:00.000Z'),
    },
  });

describe('Validação de :purchaseId nas rotas de Warranty', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  describe('ID inválido retorna 400 INVALID_PURCHASE_ID', () => {
    for (const invalidId of invalidIds) {
      it(`GET /purchases/${invalidId}/warranty → 400`, async () => {
        const { token } = await createUserWithToken();

        const response = await api().get(`/purchases/${invalidId}/warranty`).set(auth(token));

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: { message: 'Invalid purchase ID', code: 'INVALID_PURCHASE_ID' },
        });
      });

      it(`POST /purchases/${invalidId}/warranty → 400`, async () => {
        const { token } = await createUserWithToken();

        const response = await api()
          .post(`/purchases/${invalidId}/warranty`)
          .set(auth(token))
          .send(validWarrantyBody);

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: { message: 'Invalid purchase ID', code: 'INVALID_PURCHASE_ID' },
        });
      });

      it(`PUT /purchases/${invalidId}/warranty → 400`, async () => {
        const { token } = await createUserWithToken();

        const response = await api()
          .put(`/purchases/${invalidId}/warranty`)
          .set(auth(token))
          .send({ durationMonths: 24 });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: { message: 'Invalid purchase ID', code: 'INVALID_PURCHASE_ID' },
        });
      });

      it(`DELETE /purchases/${invalidId}/warranty → 400`, async () => {
        const { token } = await createUserWithToken();

        const response = await api().delete(`/purchases/${invalidId}/warranty`).set(auth(token));

        expect(response.status).toBe(400);
        expect(response.body).toEqual({
          error: { message: 'Invalid purchase ID', code: 'INVALID_PURCHASE_ID' },
        });
      });
    }
  });

  it('sem autenticação + ID inválido → 401 AUTH_REQUIRED (precedência preservada)', async () => {
    const response = await api().get('/purchases/not-a-uuid/warranty');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: { message: 'Authentication required', code: 'AUTH_REQUIRED' },
    });
  });

  it('ID inválido não cria nem consulta dados: purchase inexistente e 0 warranties', async () => {
    const { token } = await createUserWithToken();

    await api().post('/purchases/not-a-uuid/warranty').set(auth(token)).send(validWarrantyBody);

    expect(await testPrisma.warranty.count()).toBe(0);
  });

  describe('UUID válido inexistente mantém 404 PURCHASE_NOT_FOUND', () => {
    it('GET → 404', async () => {
      const { token } = await createUserWithToken();
      const response = await api()
        .get(`/purchases/${crypto.randomUUID()}/warranty`)
        .set(auth(token));

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: { message: 'Purchase not found', code: 'PURCHASE_NOT_FOUND' },
      });
    });

    it('POST → 404', async () => {
      const { token } = await createUserWithToken();
      const response = await api()
        .post(`/purchases/${crypto.randomUUID()}/warranty`)
        .set(auth(token))
        .send(validWarrantyBody);

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: { message: 'Purchase not found', code: 'PURCHASE_NOT_FOUND' },
      });
    });

    it('PUT → 404', async () => {
      const { token } = await createUserWithToken();
      const response = await api()
        .put(`/purchases/${crypto.randomUUID()}/warranty`)
        .set(auth(token))
        .send({ durationMonths: 24 });

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: { message: 'Purchase not found', code: 'PURCHASE_NOT_FOUND' },
      });
    });

    it('DELETE → 404', async () => {
      const { token } = await createUserWithToken();
      const response = await api()
        .delete(`/purchases/${crypto.randomUUID()}/warranty`)
        .set(auth(token));

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: { message: 'Purchase not found', code: 'PURCHASE_NOT_FOUND' },
      });
    });
  });

  describe('UUID válido de outro usuário mantém o ownership atual (403)', () => {
    it('GET/PUT/DELETE → 403 e não altera a warranty', async () => {
      const { user: owner } = await createUserWithToken();
      const { token: otherToken } = await createUserWithToken();
      const purchase = await createPurchase(owner.id);
      const warranty = await createWarranty(purchase.id);

      const g = await api().get(`/purchases/${purchase.id}/warranty`).set(auth(otherToken));
      const u = await api()
        .put(`/purchases/${purchase.id}/warranty`)
        .set(auth(otherToken))
        .send({ durationMonths: 24 });
      const d = await api().delete(`/purchases/${purchase.id}/warranty`).set(auth(otherToken));

      for (const response of [g, u, d]) {
        expect(response.status).toBe(403);
        expect(response.body).toEqual({
          error: {
            message: 'You do not have access to this purchase',
            code: 'PURCHASE_ACCESS_DENIED',
          },
        });
      }

      const stillThere = await testPrisma.warranty.findUnique({ where: { id: warranty.id } });
      expect(stillThere).not.toBeNull();
      expect(stillThere?.durationMonths).toBe(12);
    });
  });

  describe('UUID válido do próprio usuário continua funcionando', () => {
    it('POST 201 (sem warranty), GET 200, PUT 200, DELETE 204', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);

      const created = await api()
        .post(`/purchases/${purchase.id}/warranty`)
        .set(auth(token))
        .send(validWarrantyBody);
      expect(created.status).toBe(201);
      expect(created.body.warranty.purchaseId).toBe(purchase.id);

      const fetched = await api().get(`/purchases/${purchase.id}/warranty`).set(auth(token));
      expect(fetched.status).toBe(200);
      expect(fetched.body.warranty.id).toBe(created.body.warranty.id);

      const updated = await api()
        .put(`/purchases/${purchase.id}/warranty`)
        .set(auth(token))
        .send({ durationMonths: 24 });
      expect(updated.status).toBe(200);
      expect(updated.body.warranty.durationMonths).toBe(24);

      const removed = await api().delete(`/purchases/${purchase.id}/warranty`).set(auth(token));
      expect(removed.status).toBe(204);
      expect(
        await testPrisma.warranty.findUnique({ where: { purchaseId: purchase.id } }),
      ).toBeNull();
    });
  });
});
