import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  api,
  createPurchaseWithDocument,
  createPurchaseWithWarranty,
  createUserWithToken,
} from './helpers/http.js';
import { cleanDatabase, disconnectDatabase, testPrisma } from './helpers/db.js';

const createPurchase = async (userId: string) =>
  testPrisma.purchase.create({
    data: {
      userId,
      productName: 'Produto sem dependências',
      purchaseDate: new Date('2026-01-01T00:00:00.000Z'),
      price: '100.00',
      category: 'Eletrônicos',
    },
  });

const findPurchase = (id: string) => testPrisma.purchase.findUnique({ where: { id } });
const findDocument = (id: string) => testPrisma.document.findUnique({ where: { id } });
const findWarranty = (id: string) => testPrisma.warranty.findUnique({ where: { id } });

describe('DELETE /purchases/:id', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  it('retorna 401 sem autenticação', async () => {
    const { user } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const response = await api().delete(`/purchases/${purchase.id}`);

    expect(response.status).toBe(401);

    // The purchase must survive an unauthenticated attempt.
    expect(await findPurchase(purchase.id)).not.toBeNull();
  });

  it('exclui uma purchase sem dependências com 204', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const response = await api()
      .delete(`/purchases/${purchase.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(204);
    expect(await findPurchase(purchase.id)).toBeNull();
  });

  it('exclui uma purchase com Document (cascade) com 204', async () => {
    const { user, token } = await createUserWithToken();
    const { purchase, document } = await createPurchaseWithDocument(user.id);

    const response = await api()
      .delete(`/purchases/${purchase.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(204);
    expect(await findPurchase(purchase.id)).toBeNull();
    expect(await findDocument(document.id)).toBeNull();
  });

  it('retorna 404 para UUID válido inexistente', async () => {
    const { token } = await createUserWithToken();

    const response = await api()
      .delete(`/purchases/${crypto.randomUUID()}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: {
        message: 'Purchase not found',
        code: 'PURCHASE_NOT_FOUND',
      },
    });
  });

  it('retorna 400 PURCHASE_HAS_DEPENDENCIES quando a purchase tem Warranty', async () => {
    const { user, token } = await createUserWithToken();
    const { purchase, warranty } = await createPurchaseWithWarranty(user.id);

    const response = await api()
      .delete(`/purchases/${purchase.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        message: 'Purchase cannot be deleted while it has related data',
        code: 'PURCHASE_HAS_DEPENDENCIES',
      },
    });

    // Neither the purchase nor the warranty may be removed.
    expect(await findPurchase(purchase.id)).not.toBeNull();
    expect(await findWarranty(warranty.id)).not.toBeNull();
  });

  it('isola por usuário: outro usuário não exclui a purchase com Warranty', async () => {
    const { user: owner, token: ownerToken } = await createUserWithToken();
    const { token: otherToken } = await createUserWithToken();
    const { purchase, warranty } = await createPurchaseWithWarranty(owner.id);

    // Another user must not be able to affect the purchase at all.
    const response = await api()
      .delete(`/purchases/${purchase.id}`)
      .set('Authorization', `Bearer ${otherToken}`);

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        message: 'You do not have access to this purchase',
        code: 'PURCHASE_ACCESS_DENIED',
      },
    });

    // The purchase and warranty stay untouched after the blocked attempt.
    expect(await findPurchase(purchase.id)).not.toBeNull();
    expect(await findWarranty(warranty.id)).not.toBeNull();

    // The owner attempting the same delete still gets the dependency guard (400),
    // proving the 403 path did not leak or mutate state.
    const ownerDelete = await api()
      .delete(`/purchases/${purchase.id}`)
      .set('Authorization', `Bearer ${ownerToken}`);
    expect(ownerDelete.status).toBe(400);
    expect(ownerDelete.body.error.code).toBe('PURCHASE_HAS_DEPENDENCIES');
  });
});
