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
  store?: string | null;
  price?: string;
  category?: string;
  purchaseDate?: Date;
  createdAt?: Date;
};

const createPurchase = async (userId: string, overrides: PurchaseOverrides = {}) =>
  testPrisma.purchase.create({
    data: {
      userId,
      productName: overrides.productName ?? 'Produto',
      brand: overrides.brand ?? 'Marca',
      model: overrides.model ?? 'Modelo',
      store: overrides.store ?? 'Loja',
      purchaseDate: overrides.purchaseDate ?? startOfTodayUtc(),
      price: overrides.price ?? '100.00',
      category: overrides.category ?? 'Eletrônicos',
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    },
  });

const createWarranty = async (purchaseId: string, startDate: Date, endDate: Date) =>
  testPrisma.warranty.create({
    data: {
      purchaseId,
      durationMonths: 12,
      startDate,
      endDate,
    },
  });

const getDashboard = (token: string) =>
  api().get('/dashboard').set('Authorization', `Bearer ${token}`);

describe('GET /dashboard', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  it('retorna 401 sem autenticação', async () => {
    const response = await api().get('/dashboard');

    expect(response.status).toBe(401);
  });

  it('retorna dashboard vazio para um usuário recém-cadastrado', async () => {
    const { token } = await createUserWithToken();

    const response = await getDashboard(token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      dashboard: {
        summary: {
          totalPurchases: 0,
          totalWarranties: 0,
          activeWarranties: 0,
          totalSpent: '0.00',
        },
        expiringWarranties: [],
        recentPurchases: [],
      },
    });
  });

  it('retorna o resumo correto de compras e garantias', async () => {
    const { token, user } = await createUserWithToken();

    const purchaseA = await createPurchase(user.id);
    await createPurchase(user.id);
    await createWarranty(purchaseA.id, daysFromToday(-10), daysFromToday(20));

    const response = await getDashboard(token);

    expect(response.status).toBe(200);
    expect(response.body.dashboard.summary).toMatchObject({
      totalPurchases: 2,
      totalWarranties: 1,
      activeWarranties: 1,
    });
  });

  it('calcula totalSpent somando o price das compras do usuário', async () => {
    const { token, user } = await createUserWithToken();

    await createPurchase(user.id, { price: '100.10' });
    await createPurchase(user.id, { price: '200.20' });
    await createPurchase(user.id, { price: '50.05' });

    const response = await getDashboard(token);

    expect(response.status).toBe(200);
    expect(response.body.dashboard.summary.totalSpent).toBe('350.35');
  });

  it('conta apenas garantias ativas (data atual entre startDate e endDate)', async () => {
    const { token, user } = await createUserWithToken();

    const active = await createPurchase(user.id, { productName: 'Ativa' });
    const expired = await createPurchase(user.id, { productName: 'Vencida' });
    const future = await createPurchase(user.id, { productName: 'Futura' });

    await createWarranty(active.id, daysFromToday(-5), daysFromToday(5));
    await createWarranty(expired.id, daysFromToday(-40), daysFromToday(-1));
    await createWarranty(future.id, daysFromToday(1), daysFromToday(10));

    const response = await getDashboard(token);

    expect(response.status).toBe(200);
    expect(response.body.dashboard.summary.totalWarranties).toBe(3);
    expect(response.body.dashboard.summary.activeWarranties).toBe(1);
  });

  it('conta como ativa uma garantia que termina hoje (endDate = today)', async () => {
    const { token, user } = await createUserWithToken();

    const purchase = await createPurchase(user.id);
    // Começa no passado e termina exatamente no dia de hoje (meia-noite UTC).
    await createWarranty(purchase.id, daysFromToday(-30), startOfTodayUtc());

    const response = await getDashboard(token);

    expect(response.status).toBe(200);
    expect(response.body.dashboard.summary.activeWarranties).toBe(1);
  });

  it('não conta garantia cujo endDate é anterior a hoje', async () => {
    const { token, user } = await createUserWithToken();

    const purchase = await createPurchase(user.id);
    await createWarranty(purchase.id, daysFromToday(-40), daysFromToday(-1));

    const response = await getDashboard(token);

    expect(response.status).toBe(200);
    expect(response.body.dashboard.summary.activeWarranties).toBe(0);
  });

  it('não conta garantia cujo startDate é posterior a hoje', async () => {
    const { token, user } = await createUserWithToken();

    const purchase = await createPurchase(user.id);
    // Começa amanhã e vai além da janela: ainda não é ativa hoje.
    await createWarranty(purchase.id, daysFromToday(1), daysFromToday(30));

    const response = await getDashboard(token);

    expect(response.status).toBe(200);
    expect(response.body.dashboard.summary.activeWarranties).toBe(0);
  });

  it('retorna no máximo 5 compras recentes', async () => {
    const { token, user } = await createUserWithToken();

    for (let index = 0; index < 7; index += 1) {
      await createPurchase(user.id, {
        productName: `Produto ${index}`,
        purchaseDate: daysFromToday(-index),
      });
    }

    const response = await getDashboard(token);

    expect(response.status).toBe(200);
    expect(response.body.dashboard.recentPurchases).toHaveLength(5);
  });

  it('ordena as compras recentes por purchaseDate desc e createdAt desc', async () => {
    const { token, user } = await createUserWithToken();

    await createPurchase(user.id, { productName: 'Mais antiga', purchaseDate: daysFromToday(-10) });
    await createPurchase(user.id, { productName: 'Mais recente', purchaseDate: daysFromToday(-1) });
    await createPurchase(user.id, { productName: 'Meio', purchaseDate: daysFromToday(-5) });

    const response = await getDashboard(token);

    expect(response.status).toBe(200);
    const names = response.body.dashboard.recentPurchases.map(
      (purchase: { productName: string }) => purchase.productName,
    );
    expect(names).toEqual(['Mais recente', 'Meio', 'Mais antiga']);
  });

  it('desempata por createdAt desc quando purchaseDate é igual', async () => {
    const { token, user } = await createUserWithToken();

    const sameDate = daysFromToday(-3);
    await createPurchase(user.id, {
      productName: 'Antiga',
      purchaseDate: sameDate,
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    });
    await createPurchase(user.id, {
      productName: 'Nova',
      purchaseDate: sameDate,
      createdAt: new Date('2024-06-01T00:00:00.000Z'),
    });

    const response = await getDashboard(token);

    expect(response.status).toBe(200);
    const names = response.body.dashboard.recentPurchases.map(
      (purchase: { productName: string }) => purchase.productName,
    );
    expect(names).toEqual(['Nova', 'Antiga']);
  });

  it('inclui garantias vencendo nos próximos 30 dias e calcula dias restantes', async () => {
    const { token, user } = await createUserWithToken();

    const purchase = await createPurchase(user.id, {
      productName: 'Notebook',
      brand: 'Dell',
      model: 'XPS',
    });
    await createWarranty(purchase.id, daysFromToday(-10), daysFromToday(30));

    const response = await getDashboard(token);

    expect(response.status).toBe(200);
    const [item] = response.body.dashboard.expiringWarranties;
    expect(item).toMatchObject({
      purchaseId: purchase.id,
      productName: 'Notebook',
      brand: 'Dell',
      model: 'XPS',
      daysRemaining: 30,
    });
    expect(new Date(item.endDate).toISOString()).toBe(daysFromToday(30).toISOString());
  });

  it('não inclui garantias fora da janela de 30 dias', async () => {
    const { token, user } = await createUserWithToken();

    const expired = await createPurchase(user.id, { productName: 'Vencida' });
    const farFuture = await createPurchase(user.id, { productName: 'Distante' });
    const soon = await createPurchase(user.id, { productName: 'Próxima' });

    await createWarranty(expired.id, daysFromToday(-40), daysFromToday(-1));
    await createWarranty(farFuture.id, daysFromToday(1), daysFromToday(31));
    await createWarranty(soon.id, daysFromToday(-1), daysFromToday(10));

    const response = await getDashboard(token);

    expect(response.status).toBe(200);
    const names = response.body.dashboard.expiringWarranties.map(
      (warranty: { productName: string }) => warranty.productName,
    );
    expect(names).toEqual(['Próxima']);
  });

  it('ordena as garantias que vencem primeiro antes das demais', async () => {
    const { token, user } = await createUserWithToken();

    const purchaseA = await createPurchase(user.id, { productName: 'Vence depois' });
    const purchaseB = await createPurchase(user.id, { productName: 'Vence antes' });

    await createWarranty(purchaseA.id, daysFromToday(-1), daysFromToday(25));
    await createWarranty(purchaseB.id, daysFromToday(-1), daysFromToday(5));

    const response = await getDashboard(token);

    expect(response.status).toBe(200);
    const names = response.body.dashboard.expiringWarranties.map(
      (warranty: { productName: string }) => warranty.productName,
    );
    expect(names).toEqual(['Vence antes', 'Vence depois']);
  });

  it('nunca retorna dados de outro usuário', async () => {
    const { token, user } = await createUserWithToken();
    const { user: otherUser } = await createUserWithToken();

    const ownPurchase = await createPurchase(user.id, {
      productName: 'Meu produto',
      price: '10.00',
    });
    await createWarranty(ownPurchase.id, daysFromToday(-1), daysFromToday(5));

    const otherPurchase = await createPurchase(otherUser.id, {
      productName: 'Produto alheio',
      price: '9999.00',
    });
    await createWarranty(otherPurchase.id, daysFromToday(-1), daysFromToday(9));

    const response = await getDashboard(token);

    expect(response.status).toBe(200);
    expect(response.body.dashboard.summary).toMatchObject({
      totalPurchases: 1,
      totalWarranties: 1,
      activeWarranties: 1,
      totalSpent: '10.00',
    });

    const purchaseNames = response.body.dashboard.recentPurchases.map(
      (purchase: { productName: string }) => purchase.productName,
    );
    expect(purchaseNames).toEqual(['Meu produto']);

    const warrantyNames = response.body.dashboard.expiringWarranties.map(
      (warranty: { productName: string }) => warranty.productName,
    );
    expect(warrantyNames).toEqual(['Meu produto']);
  });
});
