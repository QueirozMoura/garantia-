import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api, createUserWithToken } from './helpers/http.js';
import { cleanDatabase, disconnectDatabase, testPrisma } from './helpers/db.js';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

// Creates a purchase owned by userId (no warranty attached yet).
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

const createWarranty = (purchaseId: string, token: string, body: unknown) =>
  api()
    .post(`/purchases/${purchaseId}/warranty`)
    .set(auth(token))
    .send(body as object);

const findWarranty = (purchaseId: string) =>
  testPrisma.warranty.findUnique({ where: { purchaseId } });

/**
 * POST /purchases/:purchaseId/warranty uses the same strict YYYY-MM-DD parser as
 * the update endpoint: dates are validated and materialized at UTC midnight, and
 * values carrying a time or offset are rejected (no timezone drift).
 */
describe('POST /purchases/:purchaseId/warranty — datas estritas (YYYY-MM-DD)', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  it('aceita YYYY-MM-DD e persiste em meia-noite UTC', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const response = await createWarranty(purchase.id, token, {
      durationMonths: 12,
      startDate: '2026-01-15',
      endDate: '2027-01-15',
    });

    expect(response.status).toBe(201);

    const persisted = await findWarranty(purchase.id);
    expect(persisted?.startDate.toISOString()).toBe('2026-01-15T00:00:00.000Z');
    expect(persisted?.endDate.toISOString()).toBe('2027-01-15T00:00:00.000Z');
  });

  it('rejeita datetime com offset de timezone (YYYY-MM-DDThh:mm:ss±hh:mm)', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const response = await createWarranty(purchase.id, token, {
      durationMonths: 12,
      startDate: '2026-01-15T00:00:00-03:00',
      endDate: '2027-01-15',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    // Nada é persistido quando a validação falha.
    expect(await findWarranty(purchase.id)).toBeNull();
  });

  it('rejeita datetime com horário e sufixo Z (YYYY-MM-DDThh:mm:ssZ)', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const response = await createWarranty(purchase.id, token, {
      durationMonths: 12,
      startDate: '2026-01-15',
      endDate: '2026-01-15T22:00:00Z',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(await findWarranty(purchase.id)).toBeNull();
  });

  it('rejeita data de calendário inválida (2026-13-40)', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const response = await createWarranty(purchase.id, token, {
      durationMonths: 12,
      startDate: '2026-13-40',
      endDate: '2027-01-15',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(await findWarranty(purchase.id)).toBeNull();
  });

  it('rejeita quando endDate é anterior a startDate', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const response = await createWarranty(purchase.id, token, {
      durationMonths: 12,
      startDate: '2027-01-15',
      endDate: '2026-01-15',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(await findWarranty(purchase.id)).toBeNull();
  });
});
