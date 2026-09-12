import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api, createUserWithToken } from './helpers/http.js';
import { cleanDatabase, disconnectDatabase, testPrisma } from './helpers/db.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Anchors "today" at UTC midnight, matching the project's date handling, so the
// scenarios stay deterministic regardless of the hour the suite runs.
const startOfTodayUtc = () => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const daysFromToday = (days: number) => new Date(startOfTodayUtc().getTime() + days * MS_PER_DAY);

type PurchaseOverrides = {
  productName?: string;
  brand?: string | null;
  model?: string | null;
  category?: string;
};

const createPurchase = async (userId: string, overrides: PurchaseOverrides = {}) =>
  testPrisma.purchase.create({
    data: {
      userId,
      productName: overrides.productName ?? 'Produto',
      brand: overrides.brand ?? 'Marca',
      model: overrides.model ?? 'Modelo',
      purchaseDate: startOfTodayUtc(),
      price: '100.00',
      category: overrides.category ?? 'Eletrônicos',
    },
  });

const createWarranty = async (
  purchaseId: string,
  startDate: Date,
  endDate: Date,
  updatedAt?: Date,
) =>
  testPrisma.warranty.create({
    data: {
      purchaseId,
      durationMonths: 12,
      startDate,
      endDate,
      ...(updatedAt ? { updatedAt } : {}),
    },
  });

const getAlerts = (token: string) => api().get('/alerts').set('Authorization', `Bearer ${token}`);

describe('GET /alerts', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  it('retorna 401 AUTH_REQUIRED sem autenticação', async () => {
    const response = await api().get('/alerts');

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

    const response = await getAlerts(token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ alerts: [] });
  });

  it('retorna lista vazia quando o usuário tem garantias mas nenhuma gera alerta', async () => {
    const { token, user } = await createUserWithToken();

    // Ativa com 60 dias restantes: fora da janela de 30 dias.
    const active = await createPurchase(user.id, { productName: 'Ativa' });
    await createWarranty(active.id, daysFromToday(-30), daysFromToday(60));

    // Futura: startDate ainda não chegou.
    const future = await createPurchase(user.id, { productName: 'Futura' });
    await createWarranty(future.id, daysFromToday(10), daysFromToday(400));

    const response = await getAlerts(token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ alerts: [] });
  });

  it('gera WARRANTY_EXPIRING para garantia que vence em 10 dias', async () => {
    const { token, user } = await createUserWithToken();

    const purchase = await createPurchase(user.id, {
      productName: 'Notebook',
      brand: 'Dell',
      model: 'Inspiron',
      category: 'Informática',
    });
    const warranty = await createWarranty(purchase.id, daysFromToday(-355), daysFromToday(10));

    const response = await getAlerts(token);

    expect(response.status).toBe(200);
    expect(response.body.alerts).toHaveLength(1);

    const [alert] = response.body.alerts;
    expect(alert).toMatchObject({
      id: warranty.id,
      type: 'WARRANTY_EXPIRING',
      title: 'Garantia vencendo em breve',
      message: 'A garantia do produto Notebook vence em 10 dias.',
    });
    expect(alert.warranty).toMatchObject({
      id: warranty.id,
      purchaseId: purchase.id,
    });
    expect(new Date(alert.warranty.startDate).toISOString()).toBe(
      daysFromToday(-355).toISOString(),
    );
    expect(new Date(alert.warranty.endDate).toISOString()).toBe(daysFromToday(10).toISOString());
    expect(alert.purchase).toEqual({
      id: purchase.id,
      productName: 'Notebook',
      brand: 'Dell',
      model: 'Inspiron',
      category: 'Informática',
    });
    expect(alert.purchase).not.toHaveProperty('userId');
    expect(alert.purchase).not.toHaveProperty('price');
    expect(alert.createdAt).toBeTruthy();
  });

  it('gera WARRANTY_EXPIRING com "vence hoje" quando endDate é hoje', async () => {
    const { token, user } = await createUserWithToken();

    const purchase = await createPurchase(user.id, { productName: 'Monitor' });
    await createWarranty(purchase.id, daysFromToday(-365), daysFromToday(0));

    const response = await getAlerts(token);

    expect(response.status).toBe(200);
    expect(response.body.alerts).toHaveLength(1);
    expect(response.body.alerts[0]).toMatchObject({
      type: 'WARRANTY_EXPIRING',
      message: 'A garantia do produto Monitor vence hoje.',
    });
  });

  it('gera WARRANTY_EXPIRING com "vence em 1 dia" (singular) quando endDate é amanhã', async () => {
    const { token, user } = await createUserWithToken();

    const purchase = await createPurchase(user.id, { productName: 'Máquina de lavar' });
    await createWarranty(purchase.id, daysFromToday(-364), daysFromToday(1));

    const response = await getAlerts(token);

    expect(response.status).toBe(200);
    expect(response.body.alerts).toHaveLength(1);
    expect(response.body.alerts[0]).toMatchObject({
      type: 'WARRANTY_EXPIRING',
      message: 'A garantia do produto Máquina de lavar vence em 1 dia.',
    });
  });

  it('gera WARRANTY_EXPIRED para garantia vencida há 10 dias', async () => {
    const { token, user } = await createUserWithToken();

    const purchase = await createPurchase(user.id, { productName: 'Geladeira' });
    await createWarranty(purchase.id, daysFromToday(-375), daysFromToday(-10));

    const response = await getAlerts(token);

    expect(response.status).toBe(200);
    expect(response.body.alerts).toHaveLength(1);
    expect(response.body.alerts[0]).toMatchObject({
      type: 'WARRANTY_EXPIRED',
      title: 'Garantia vencida',
      message: 'A garantia do produto Geladeira venceu há 10 dias.',
    });
  });

  it('gera WARRANTY_EXPIRED com "venceu há 1 dia" (singular) quando venceu ontem', async () => {
    const { token, user } = await createUserWithToken();

    const purchase = await createPurchase(user.id, { productName: 'Fogão' });
    await createWarranty(purchase.id, daysFromToday(-366), daysFromToday(-1));

    const response = await getAlerts(token);

    expect(response.status).toBe(200);
    expect(response.body.alerts).toHaveLength(1);
    expect(response.body.alerts[0]).toMatchObject({
      type: 'WARRANTY_EXPIRED',
      message: 'A garantia do produto Fogão venceu há 1 dia.',
    });
  });

  it('não gera alerta para garantia fora da janela de 30 dias', async () => {
    const { token, user } = await createUserWithToken();

    const purchase = await createPurchase(user.id, { productName: 'Ativa longa' });
    await createWarranty(purchase.id, daysFromToday(-10), daysFromToday(31));

    const response = await getAlerts(token);

    expect(response.status).toBe(200);
    expect(response.body.alerts).toEqual([]);
  });

  it('considera o limite de 30 dias de forma inclusiva', async () => {
    const { token, user } = await createUserWithToken();

    const purchase = await createPurchase(user.id, { productName: 'No limite' });
    await createWarranty(purchase.id, daysFromToday(-10), daysFromToday(30));

    const response = await getAlerts(token);

    expect(response.status).toBe(200);
    expect(response.body.alerts).toHaveLength(1);
    expect(response.body.alerts[0]).toMatchObject({
      type: 'WARRANTY_EXPIRING',
      message: 'A garantia do produto No limite vence em 30 dias.',
    });
  });

  it('não gera alerta para garantia futura (startDate no futuro)', async () => {
    const { token, user } = await createUserWithToken();

    const purchase = await createPurchase(user.id, { productName: 'Futura' });
    // endDate já passou da janela, mas startDate ainda está no futuro.
    await createWarranty(purchase.id, daysFromToday(5), daysFromToday(20));

    const response = await getAlerts(token);

    expect(response.status).toBe(200);
    expect(response.body.alerts).toEqual([]);
  });

  it('isola os alertas por usuário: cada um só enxerga os próprios', async () => {
    const { token: tokenA, user: userA } = await createUserWithToken();
    const { token: tokenB, user: userB } = await createUserWithToken();

    const purchaseA = await createPurchase(userA.id, { productName: 'Produto A' });
    const purchaseB = await createPurchase(userB.id, { productName: 'Produto B' });

    await createWarranty(purchaseA.id, daysFromToday(-355), daysFromToday(10));
    await createWarranty(purchaseB.id, daysFromToday(-30), daysFromToday(60));

    const responseA = await getAlerts(tokenA);
    const responseB = await getAlerts(tokenB);

    expect(responseA.status).toBe(200);
    expect(responseB.status).toBe(200);

    expect(responseA.body.alerts).toHaveLength(1);
    expect(responseA.body.alerts[0].purchase.productName).toBe('Produto A');

    // B só tem uma garantia que não gera alerta.
    expect(responseB.body.alerts).toEqual([]);
  });

  it('ignora userId vindo do cliente (query/header) e usa apenas o token', async () => {
    const { token: tokenA, user: userA } = await createUserWithToken();
    const { user: userB } = await createUserWithToken();

    const purchaseA = await createPurchase(userA.id, { productName: 'Produto A' });
    const purchaseB = await createPurchase(userB.id, { productName: 'Produto B' });

    await createWarranty(purchaseA.id, daysFromToday(-355), daysFromToday(10));
    await createWarranty(purchaseB.id, daysFromToday(-355), daysFromToday(5));

    const response = await api()
      .get(`/alerts?userId=${userB.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-user-id', userB.id);

    expect(response.status).toBe(200);
    expect(response.body.alerts).toHaveLength(1);
    expect(response.body.alerts[0].purchase.productName).toBe('Produto A');
  });

  it('ordena por urgência: vencendo hoje, 1 dia, 5 dias, depois vencidos (mais antigo primeiro)', async () => {
    const { token, user } = await createUserWithToken();

    const today = await createPurchase(user.id, { productName: 'Vence hoje' });
    const oneDay = await createPurchase(user.id, { productName: 'Vence em 1' });
    const fiveDays = await createPurchase(user.id, { productName: 'Vence em 5' });
    const expiredTen = await createPurchase(user.id, { productName: 'Venceu há 10' });
    const expiredThree = await createPurchase(user.id, { productName: 'Venceu há 3' });

    await createWarranty(today.id, daysFromToday(-365), daysFromToday(0));
    await createWarranty(oneDay.id, daysFromToday(-364), daysFromToday(1));
    await createWarranty(fiveDays.id, daysFromToday(-360), daysFromToday(5));
    await createWarranty(expiredTen.id, daysFromToday(-375), daysFromToday(-10));
    await createWarranty(expiredThree.id, daysFromToday(-368), daysFromToday(-3));

    const response = await getAlerts(token);

    expect(response.status).toBe(200);
    const productNames = response.body.alerts.map(
      (alert: { purchase: { productName: string } }) => alert.purchase.productName,
    );
    expect(productNames).toEqual([
      'Vence hoje',
      'Vence em 1',
      'Vence em 5',
      'Venceu há 10',
      'Venceu há 3',
    ]);

    const types = response.body.alerts.map((alert: { type: string }) => alert.type);
    expect(types).toEqual([
      'WARRANTY_EXPIRING',
      'WARRANTY_EXPIRING',
      'WARRANTY_EXPIRING',
      'WARRANTY_EXPIRED',
      'WARRANTY_EXPIRED',
    ]);
  });

  it('não quebra as rotas existentes de garantias', async () => {
    const { token, user } = await createUserWithToken();

    const purchase = await createPurchase(user.id, { productName: 'Produto regressão' });
    const warranty = await createWarranty(purchase.id, daysFromToday(-355), daysFromToday(100));

    // GET /warranties
    const list = await api().get('/warranties').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.warranties).toHaveLength(1);
    expect(list.body.warranties[0].id).toBe(warranty.id);

    // GET /purchases/:purchaseId/warranty
    const perPurchase = await api()
      .get(`/purchases/${purchase.id}/warranty`)
      .set('Authorization', `Bearer ${token}`);
    expect(perPurchase.status).toBe(200);
    expect(perPurchase.body.warranty.id).toBe(warranty.id);
    expect(perPurchase.body.warranty.purchaseId).toBe(purchase.id);
  });
});
