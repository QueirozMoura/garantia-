import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api, createUserWithToken } from './helpers/http.js';
import { cleanDatabase, disconnectDatabase, testPrisma } from './helpers/db.js';

const auth = (token: string) => ({ Authorization: `Bearer ${token}` });

type PurchaseOverrides = {
  productName?: string;
};

const createPurchase = async (userId: string, overrides: PurchaseOverrides = {}) =>
  testPrisma.purchase.create({
    data: {
      userId,
      productName: overrides.productName ?? 'Produto',
      purchaseDate: new Date('2024-01-01T00:00:00.000Z'),
      price: '100.00',
      category: 'Eletrônicos',
    },
  });

const createWarranty = async (
  purchaseId: string,
  startDate = new Date('2024-01-01T00:00:00.000Z'),
  endDate = new Date('2025-01-01T00:00:00.000Z'),
) =>
  testPrisma.warranty.create({
    data: { purchaseId, durationMonths: 12, startDate, endDate },
  });

const updateWarranty = (purchaseId: string, token: string, body: unknown) =>
  api()
    .put(`/purchases/${purchaseId}/warranty`)
    .set(auth(token))
    .send(body as object);

const findWarranty = (purchaseId: string) =>
  testPrisma.warranty.findUnique({ where: { purchaseId } });

describe('PUT /purchases/:purchaseId/warranty', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  it('sem autenticação → 401 AUTH_REQUIRED', async () => {
    const response = await api()
      .put(`/purchases/${crypto.randomUUID()}/warranty`)
      .send({ durationMonths: 24 });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: { message: 'Authentication required', code: 'AUTH_REQUIRED' },
    });
  });

  it('UUID inválido → 400 INVALID_PURCHASE_ID (sem consultar o banco)', async () => {
    const { token } = await createUserWithToken();

    const response = await api()
      .put('/purchases/not-a-uuid/warranty')
      .set(auth(token))
      .send({ durationMonths: 24 });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { message: 'Invalid purchase ID', code: 'INVALID_PURCHASE_ID' },
    });
  });

  it('compra inexistente → 404 PURCHASE_NOT_FOUND', async () => {
    const { token } = await createUserWithToken();

    const response = await updateWarranty(crypto.randomUUID(), token, { durationMonths: 24 });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { message: 'Purchase not found', code: 'PURCHASE_NOT_FOUND' },
    });
  });

  it('compra de outro usuário → 403 PURCHASE_ACCESS_DENIED e não altera a garantia', async () => {
    const { user: owner } = await createUserWithToken();
    const { token: otherToken } = await createUserWithToken();
    const purchase = await createPurchase(owner.id);
    const warranty = await createWarranty(purchase.id);

    const response = await updateWarranty(purchase.id, otherToken, { durationMonths: 24 });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        message: 'You do not have access to this purchase',
        code: 'PURCHASE_ACCESS_DENIED',
      },
    });

    const stillThere = await findWarranty(purchase.id);
    expect(stillThere?.id).toBe(warranty.id);
    expect(stillThere?.durationMonths).toBe(12);
  });

  it('compra existente sem garantia → mantém o comportamento atual (404 WARRANTY_NOT_FOUND)', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const response = await updateWarranty(purchase.id, token, { durationMonths: 24 });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { message: 'Warranty not found', code: 'WARRANTY_NOT_FOUND' },
    });
  });

  it('atualização válida de durationMonths → 200 com o contrato atual', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);
    const warranty = await createWarranty(purchase.id);

    const response = await updateWarranty(purchase.id, token, { durationMonths: 24 });

    expect(response.status).toBe(200);
    expect(response.body.warranty).toMatchObject({
      id: warranty.id,
      purchaseId: purchase.id,
      durationMonths: 24,
    });
    // Contrato preservado: a garantia continua vinculada à mesma compra.
    expect(response.body.warranty.purchaseId).toBe(purchase.id);
    expect(response.body.warranty.id).toBe(warranty.id);
    // Datas não enviadas permanecem inalteradas.
    expect(new Date(response.body.warranty.startDate).toISOString()).toBe(
      warranty.startDate.toISOString(),
    );
    expect(new Date(response.body.warranty.endDate).toISOString()).toBe(
      warranty.endDate.toISOString(),
    );
  });

  it('atualização válida de startDate/endDate grava em UTC midnight (sem drift de fuso)', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);
    await createWarranty(purchase.id);

    const response = await updateWarranty(purchase.id, token, {
      startDate: '2026-09-10',
      endDate: '2027-09-10',
    });

    expect(response.status).toBe(200);
    expect(new Date(response.body.warranty.startDate).toISOString()).toBe(
      '2026-09-10T00:00:00.000Z',
    );
    expect(new Date(response.body.warranty.endDate).toISOString()).toBe('2027-09-10T00:00:00.000Z');

    const persisted = await findWarranty(purchase.id);
    expect(persisted?.startDate.toISOString()).toBe('2026-09-10T00:00:00.000Z');
    expect(persisted?.endDate.toISOString()).toBe('2027-09-10T00:00:00.000Z');
    // durationMonths não foi enviado e permanece o valor original.
    expect(persisted?.durationMonths).toBe(12);
  });

  it('permite atualizar os três campos de uma só vez', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);
    await createWarranty(purchase.id);

    const response = await updateWarranty(purchase.id, token, {
      durationMonths: 36,
      startDate: '2026-01-01',
      endDate: '2029-01-01',
    });

    expect(response.status).toBe(200);
    expect(response.body.warranty).toMatchObject({ durationMonths: 36 });
    expect(new Date(response.body.warranty.startDate).toISOString()).toBe(
      '2026-01-01T00:00:00.000Z',
    );
    expect(new Date(response.body.warranty.endDate).toISOString()).toBe('2029-01-01T00:00:00.000Z');
  });

  it('rejeita endDate anterior a startDate quando ambos vêm no payload → 400', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);
    await createWarranty(purchase.id);

    const response = await updateWarranty(purchase.id, token, {
      startDate: '2027-09-10',
      endDate: '2026-09-10',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');

    const persisted = await findWarranty(purchase.id);
    expect(persisted?.startDate.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    expect(persisted?.endDate.toISOString()).toBe('2025-01-01T00:00:00.000Z');
  });

  it('rejeita endDate anterior ao startDate já persistido quando só endDate é enviado → 400', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);
    // startDate persistido = 2024-01-01.
    await createWarranty(purchase.id);

    const response = await updateWarranty(purchase.id, token, { endDate: '2023-12-31' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        message: 'End date cannot be before start date',
        code: 'INVALID_WARRANTY_DATE_RANGE',
      },
    });

    const persisted = await findWarranty(purchase.id);
    expect(persisted?.endDate.toISOString()).toBe('2025-01-01T00:00:00.000Z');
  });

  it('rejeita startDate posterior ao endDate já persistido quando só startDate é enviado → 400', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);
    // endDate persistido = 2025-01-01.
    await createWarranty(purchase.id);

    const response = await updateWarranty(purchase.id, token, { startDate: '2025-01-02' });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        message: 'End date cannot be before start date',
        code: 'INVALID_WARRANTY_DATE_RANGE',
      },
    });
  });

  it('aceita endDate igual a startDate', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);
    await createWarranty(purchase.id);

    const response = await updateWarranty(purchase.id, token, {
      startDate: '2026-09-10',
      endDate: '2026-09-10',
    });

    expect(response.status).toBe(200);
  });

  it('rejeita durationMonths inválido (0, negativo, fracionário, não numérico) → 400', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);
    await createWarranty(purchase.id);

    for (const durationMonths of [0, -1, 1.5, 'doze']) {
      const response = await updateWarranty(purchase.id, token, { durationMonths });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }

    const persisted = await findWarranty(purchase.id);
    expect(persisted?.durationMonths).toBe(12);
  });

  it('rejeita datas fora do formato YYYY-MM-DD → 400', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);
    await createWarranty(purchase.id);

    const invalidDates = [
      '09/10/2026',
      '2026-9-10',
      '2026-13-01',
      '2026-09-10T10:00:00Z',
      'amanhã',
    ];

    for (const value of invalidDates) {
      const response = await updateWarranty(purchase.id, token, { startDate: value });

      expect(response.status).toBe(400);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    }

    const persisted = await findWarranty(purchase.id);
    expect(persisted?.startDate.toISOString()).toBe('2024-01-01T00:00:00.000Z');
  });

  it('rejeita payload vazio e ignora campos não permitidos (sem mass assignment)', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);
    const warranty = await createWarranty(purchase.id);
    const otherPurchase = await createPurchase(user.id, { productName: 'Outra' });

    const empty = await updateWarranty(purchase.id, token, {});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');

    // Campos internos/relacionais no corpo são descartados pelo schema e não
    // alteram id, purchaseId, createdAt nem updatedAt.
    const response = await updateWarranty(purchase.id, token, {
      durationMonths: 24,
      id: crypto.randomUUID(),
      purchaseId: otherPurchase.id,
      createdAt: '2000-01-01T00:00:00.000Z',
      updatedAt: '2000-01-01T00:00:00.000Z',
      userId: crypto.randomUUID(),
    });

    expect(response.status).toBe(200);
    expect(response.body.warranty.id).toBe(warranty.id);
    expect(response.body.warranty.purchaseId).toBe(purchase.id);
    expect(response.body.warranty.durationMonths).toBe(24);
    // createdAt não pode ter sido sobrescrito pelo valor enviado.
    expect(new Date(response.body.warranty.createdAt).toISOString()).toBe(
      warranty.createdAt.toISOString(),
    );

    // A garantia continua única e vinculada à compra original.
    const warrantiesForPurchase = await testPrisma.warranty.count({
      where: { purchaseId: purchase.id },
    });
    expect(warrantiesForPurchase).toBe(1);
    const persisted = await findWarranty(purchase.id);
    expect(persisted?.id).toBe(warranty.id);
    expect(persisted?.purchaseId).toBe(purchase.id);
    expect(await findWarranty(otherPurchase.id)).toBeNull();
  });

  it('não cria garantia para compra sem garantia ao chamar PUT (não inventa comportamento)', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    await updateWarranty(purchase.id, token, { durationMonths: 24 });

    expect(await findWarranty(purchase.id)).toBeNull();
  });

  it('PUT do próprio usuário mantém a garantia na mesma compra e a listagem reflete a mudança', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);
    const warranty = await createWarranty(purchase.id);

    const updated = await updateWarranty(purchase.id, token, { durationMonths: 48 });
    expect(updated.status).toBe(200);

    const fetched = await api().get(`/purchases/${purchase.id}/warranty`).set(auth(token));
    expect(fetched.status).toBe(200);
    expect(fetched.body.warranty.id).toBe(warranty.id);
    expect(fetched.body.warranty.purchaseId).toBe(purchase.id);

    const list = await api().get('/purchases').set(auth(token));
    const [item] = list.body.purchases;
    expect(item.id).toBe(purchase.id);
    expect(item.warranty.id).toBe(warranty.id);
    expect(item.warranty.durationMonths).toBe(48);
    // A listagem continua expondo somente os quatro campos.
    expect(Object.keys(item.warranty).sort()).toEqual(
      ['durationMonths', 'endDate', 'id', 'startDate'].sort(),
    );
  });

  it('POST/GET/DELETE de warranty continuam funcionando após um PUT', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    // POST continua criando (201).
    const created = await api()
      .post(`/purchases/${purchase.id}/warranty`)
      .set(auth(token))
      .send({ durationMonths: 12, startDate: '2024-01-01', endDate: '2025-01-01' });
    expect(created.status).toBe(201);

    // PUT atualiza a garantia existente sem trocar de compra.
    const updated = await updateWarranty(purchase.id, token, { durationMonths: 24 });
    expect(updated.status).toBe(200);
    expect(updated.body.warranty.purchaseId).toBe(purchase.id);

    // GET continua retornando a garantia atualizada.
    const fetched = await api().get(`/purchases/${purchase.id}/warranty`).set(auth(token));
    expect(fetched.status).toBe(200);
    expect(fetched.body.warranty.durationMonths).toBe(24);

    // DELETE continua removendo (204) e o PUT depois passa a retornar 404.
    const removed = await api().delete(`/purchases/${purchase.id}/warranty`).set(auth(token));
    expect(removed.status).toBe(204);

    const afterDelete = await updateWarranty(purchase.id, token, { durationMonths: 12 });
    expect(afterDelete.status).toBe(404);
    expect(afterDelete.body).toEqual({
      error: { message: 'Warranty not found', code: 'WARRANTY_NOT_FOUND' },
    });
  });
});
