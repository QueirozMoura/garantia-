import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api, createUserWithToken } from './helpers/http.js';
import { cleanDatabase, disconnectDatabase, testPrisma } from './helpers/db.js';

type PurchaseOverrides = {
  productName?: string;
  brand?: string | null;
  model?: string | null;
  purchaseDate?: Date;
  category?: string;
};

const createPurchase = async (userId: string, overrides: PurchaseOverrides = {}) =>
  testPrisma.purchase.create({
    data: {
      userId,
      productName: overrides.productName ?? 'Produto',
      brand: overrides.brand ?? 'Marca',
      model: overrides.model ?? 'Modelo',
      purchaseDate: overrides.purchaseDate ?? new Date('2026-09-04T00:00:00.000Z'),
      price: '100.00',
      category: overrides.category ?? 'Eletrônicos',
    },
  });

const createWarranty = async (
  purchaseId: string,
  startDate: Date,
  endDate: Date,
  createdAt?: Date,
) =>
  testPrisma.warranty.create({
    data: {
      purchaseId,
      durationMonths: 12,
      startDate,
      endDate,
      ...(createdAt ? { createdAt } : {}),
    },
  });

const getWarranties = (token: string) =>
  api().get('/warranties').set('Authorization', `Bearer ${token}`);

describe('GET /warranties', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  it('retorna 401 AUTH_REQUIRED sem autenticação', async () => {
    const response = await api().get('/warranties');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      },
    });
  });

  it('retorna lista vazia (200) para um usuário sem garantias', async () => {
    const { token } = await createUserWithToken();

    const response = await getWarranties(token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ warranties: [] });
  });

  it('retorna as garantias do usuário autenticado com os dados da compra', async () => {
    const { token, user } = await createUserWithToken();

    const purchase = await createPurchase(user.id, {
      productName: 'Notebook',
      brand: 'Dell',
      model: 'Inspiron',
      category: 'Informática',
    });
    const startDate = new Date('2026-09-04T00:00:00.000Z');
    const endDate = new Date('2027-09-04T00:00:00.000Z');
    const warranty = await createWarranty(purchase.id, startDate, endDate);

    const response = await getWarranties(token);

    expect(response.status).toBe(200);
    expect(response.body.warranties).toHaveLength(1);

    const [item] = response.body.warranties;
    expect(item).toMatchObject({
      id: warranty.id,
      purchaseId: purchase.id,
      durationMonths: 12,
    });
    expect(new Date(item.startDate).toISOString()).toBe(startDate.toISOString());
    expect(new Date(item.endDate).toISOString()).toBe(endDate.toISOString());
    expect(item.createdAt).toBeTruthy();
    expect(item.updatedAt).toBeTruthy();

    // Dados básicos da compra relacionada.
    expect(item.purchase).toEqual({
      id: purchase.id,
      productName: 'Notebook',
      brand: 'Dell',
      model: 'Inspiron',
      purchaseDate: '2026-09-04T00:00:00.000Z',
      category: 'Informática',
    });
  });

  it('não vaza campos internos da compra ou do usuário', async () => {
    const { token, user } = await createUserWithToken();

    const purchase = await createPurchase(user.id);
    await createWarranty(
      purchase.id,
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('2027-09-01T00:00:00.000Z'),
    );

    const response = await getWarranties(token);

    expect(response.status).toBe(200);
    const [item] = response.body.warranties;
    expect(Object.keys(item).sort()).toEqual(
      [
        'createdAt',
        'durationMonths',
        'endDate',
        'id',
        'purchase',
        'purchaseId',
        'startDate',
        'updatedAt',
      ].sort(),
    );
    expect(Object.keys(item.purchase).sort()).toEqual(
      ['brand', 'category', 'id', 'model', 'productName', 'purchaseDate'].sort(),
    );
    expect(item.purchase).not.toHaveProperty('userId');
    expect(item.purchase).not.toHaveProperty('price');
  });

  it('ordena por endDate asc', async () => {
    const { token, user } = await createUserWithToken();

    const later = await createPurchase(user.id, { productName: 'Vence depois' });
    const sooner = await createPurchase(user.id, { productName: 'Vence antes' });
    const middle = await createPurchase(user.id, { productName: 'Vence no meio' });

    await createWarranty(
      later.id,
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('2028-09-01T00:00:00.000Z'),
    );
    await createWarranty(
      sooner.id,
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('2027-01-01T00:00:00.000Z'),
    );
    await createWarranty(
      middle.id,
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('2027-06-01T00:00:00.000Z'),
    );

    const response = await getWarranties(token);

    expect(response.status).toBe(200);
    const names = response.body.warranties.map(
      (warranty: { purchase: { productName: string } }) => warranty.purchase.productName,
    );
    expect(names).toEqual(['Vence antes', 'Vence no meio', 'Vence depois']);
  });

  it('desempata por createdAt desc quando endDate é igual', async () => {
    const { token, user } = await createUserWithToken();

    const older = await createPurchase(user.id, { productName: 'Criada antes' });
    const newer = await createPurchase(user.id, { productName: 'Criada depois' });

    const sameEndDate = new Date('2027-09-01T00:00:00.000Z');
    await createWarranty(
      older.id,
      new Date('2026-09-01T00:00:00.000Z'),
      sameEndDate,
      new Date('2024-01-01T00:00:00.000Z'),
    );
    await createWarranty(
      newer.id,
      new Date('2026-09-01T00:00:00.000Z'),
      sameEndDate,
      new Date('2024-06-01T00:00:00.000Z'),
    );

    const response = await getWarranties(token);

    expect(response.status).toBe(200);
    const names = response.body.warranties.map(
      (warranty: { purchase: { productName: string } }) => warranty.purchase.productName,
    );
    expect(names).toEqual(['Criada depois', 'Criada antes']);
  });

  it('isola as garantias por usuário: cada um só enxerga as próprias', async () => {
    const { token: tokenA, user: userA } = await createUserWithToken();
    const { token: tokenB, user: userB } = await createUserWithToken();

    const purchaseA = await createPurchase(userA.id, { productName: 'Produto A' });
    const purchaseB = await createPurchase(userB.id, { productName: 'Produto B' });

    await createWarranty(
      purchaseA.id,
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('2027-09-01T00:00:00.000Z'),
    );
    await createWarranty(
      purchaseB.id,
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('2028-09-01T00:00:00.000Z'),
    );

    const responseA = await getWarranties(tokenA);
    const responseB = await getWarranties(tokenB);

    expect(responseA.status).toBe(200);
    expect(responseB.status).toBe(200);

    expect(responseA.body.warranties).toHaveLength(1);
    expect(responseA.body.warranties[0].purchase.productName).toBe('Produto A');

    expect(responseB.body.warranties).toHaveLength(1);
    expect(responseB.body.warranties[0].purchase.productName).toBe('Produto B');

    // Nenhum dos dois vê a garantia do outro.
    expect(responseA.body.warranties[0].purchaseId).toBe(purchaseA.id);
    expect(responseA.body.warranties[0].purchaseId).not.toBe(purchaseB.id);
    expect(responseB.body.warranties[0].purchaseId).not.toBe(purchaseA.id);
  });

  it('não quebra a rota por compra GET /purchases/:purchaseId/warranty', async () => {
    const { token, user } = await createUserWithToken();

    const purchase = await createPurchase(user.id, { productName: 'Produto isolado' });
    const warranty = await createWarranty(
      purchase.id,
      new Date('2026-09-01T00:00:00.000Z'),
      new Date('2027-09-01T00:00:00.000Z'),
    );

    const response = await api()
      .get(`/purchases/${purchase.id}/warranty`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.warranty.id).toBe(warranty.id);
    expect(response.body.warranty.purchaseId).toBe(purchase.id);
  });
});
