import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api, createUserWithToken } from './helpers/http.js';
import { cleanDatabase, disconnectDatabase, testPrisma } from './helpers/db.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// Anchors "today" at UTC midnight, matching the project's date handling
// (dashboard/alerts tests), so the warranty-status scenarios stay deterministic
// regardless of the hour the suite runs.
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
  serialNumber?: string | null;
  price?: string;
  category?: string;
  purchaseDate?: Date;
};

const createPurchase = async (userId: string, overrides: PurchaseOverrides = {}) =>
  testPrisma.purchase.create({
    data: {
      userId,
      productName: overrides.productName ?? 'Produto',
      brand: overrides.brand ?? 'Marca',
      model: overrides.model ?? 'Modelo',
      store: overrides.store ?? 'Loja',
      serialNumber: overrides.serialNumber ?? 'SN-0001',
      purchaseDate: overrides.purchaseDate ?? startOfTodayUtc(),
      price: overrides.price ?? '100.00',
      category: overrides.category ?? 'Eletrônicos',
    },
  });

const createWarranty = async (purchaseId: string, startDate: Date, endDate: Date) =>
  testPrisma.warranty.create({
    data: { purchaseId, durationMonths: 12, startDate, endDate },
  });

const postAssistance = (purchaseId: string, token: string, body: unknown) =>
  api()
    .post(`/purchases/${purchaseId}/assistance`)
    .set('Authorization', `Bearer ${token}`)
    .send(body as object);

const validProblem = 'A máquina de lavar não está centrifugando.';

describe('POST /purchases/:purchaseId/assistance', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  it('usuário autenticado, compra própria e garantia ativa → 200 ACTIVE', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id, {
      productName: 'Máquina de lavar',
      brand: 'Brastemp',
      model: 'BWF11',
      store: 'Magazine',
      serialNumber: 'SN-SECRET',
      price: '2599.90',
    });
    const warranty = await createWarranty(purchase.id, daysFromToday(-10), daysFromToday(10));

    const response = await postAssistance(purchase.id, token, { problem: validProblem });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      assistance: {
        problem: validProblem,
        warrantyStatus: 'ACTIVE',
        purchase: {
          id: purchase.id,
          productName: 'Máquina de lavar',
          brand: 'Brastemp',
          model: 'BWF11',
          store: 'Magazine',
          purchaseDate: purchase.purchaseDate.toISOString(),
        },
        warranty: {
          id: warranty.id,
          durationMonths: 12,
          startDate: warranty.startDate.toISOString(),
          endDate: warranty.endDate.toISOString(),
        },
      },
    });
  });

  it('compra própria com garantia expirada → 200 EXPIRED', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);
    await createWarranty(purchase.id, daysFromToday(-40), daysFromToday(-1));

    const response = await postAssistance(purchase.id, token, { problem: validProblem });

    expect(response.status).toBe(200);
    expect(response.body.assistance.warrantyStatus).toBe('EXPIRED');
  });

  it('compra própria com garantia futura → 200 UPCOMING', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);
    await createWarranty(purchase.id, daysFromToday(1), daysFromToday(30));

    const response = await postAssistance(purchase.id, token, { problem: validProblem });

    expect(response.status).toBe(200);
    expect(response.body.assistance.warrantyStatus).toBe('UPCOMING');
  });

  it('compra própria sem garantia → 200 NONE com warranty null', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const response = await postAssistance(purchase.id, token, { problem: validProblem });

    expect(response.status).toBe(200);
    expect(response.body.assistance.warrantyStatus).toBe('NONE');
    expect(response.body.assistance.warranty).toBeNull();
  });

  it('sem autenticação → 401 AUTH_REQUIRED', async () => {
    const response = await api()
      .post(`/purchases/${crypto.randomUUID()}/assistance`)
      .send({ problem: validProblem });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: { message: 'Authentication required', code: 'AUTH_REQUIRED' },
    });
  });

  it('purchaseId inválido → 400 INVALID_PURCHASE_ID (sem consultar o banco)', async () => {
    const { token } = await createUserWithToken();

    const response = await postAssistance('not-a-uuid', token, { problem: validProblem });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { message: 'Invalid purchase ID', code: 'INVALID_PURCHASE_ID' },
    });
  });

  it('compra inexistente → 404 PURCHASE_NOT_FOUND', async () => {
    const { token } = await createUserWithToken();

    const response = await postAssistance(crypto.randomUUID(), token, { problem: validProblem });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { message: 'Purchase not found', code: 'PURCHASE_NOT_FOUND' },
    });
  });

  it('compra de outro usuário → 403 PURCHASE_ACCESS_DENIED', async () => {
    const { user: owner } = await createUserWithToken();
    const { token: otherToken } = await createUserWithToken();
    const purchase = await createPurchase(owner.id);

    const response = await postAssistance(purchase.id, otherToken, { problem: validProblem });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        message: 'You do not have access to this purchase',
        code: 'PURCHASE_ACCESS_DENIED',
      },
    });
  });

  it('problem ausente → 400 VALIDATION_ERROR', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const response = await postAssistance(purchase.id, token, {});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('problem vazio → 400', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const response = await postAssistance(purchase.id, token, { problem: '' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('problem somente com espaços → 400', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const response = await postAssistance(purchase.id, token, { problem: '     ' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('problem menor que 5 caracteres → 400', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const response = await postAssistance(purchase.id, token, { problem: 'abcd' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('problem maior que 2000 caracteres → 400', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const response = await postAssistance(purchase.id, token, { problem: 'a'.repeat(2001) });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('campo adicional no body → 400 (objeto estrito, sem mass assignment)', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);
    const otherPurchase = await createPurchase(user.id);

    const response = await postAssistance(purchase.id, token, {
      problem: validProblem,
      purchaseId: otherPurchase.id,
      userId: crypto.randomUUID(),
      warrantyStatus: 'ACTIVE',
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('problem com número → 400', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const response = await postAssistance(purchase.id, token, { problem: 12345 });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('problem com array → 400', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const response = await postAssistance(purchase.id, token, { problem: ['a', 'b', 'c'] });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('problem com objeto → 400', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const response = await postAssistance(purchase.id, token, { problem: { text: 'falha' } });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('problem com null → 400', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const response = await postAssistance(purchase.id, token, { problem: null });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('faz trim do problem e retorna o texto normalizado', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const response = await postAssistance(purchase.id, token, {
      problem: '   A máquina não centrifuga.   ',
    });

    expect(response.status).toBe(200);
    expect(response.body.assistance.problem).toBe('A máquina não centrifuga.');
  });

  it('não vaza userId, price nem serialNumber na resposta', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id, {
      serialNumber: 'SN-SECRET',
      price: '1234.56',
    });
    await createWarranty(purchase.id, daysFromToday(-5), daysFromToday(5));

    const response = await postAssistance(purchase.id, token, { problem: validProblem });

    expect(response.status).toBe(200);
    expect(Object.keys(response.body.assistance.purchase).sort()).toEqual(
      ['brand', 'id', 'model', 'productName', 'purchaseDate', 'store'].sort(),
    );
    expect(response.body.assistance.purchase).not.toHaveProperty('userId');
    expect(response.body.assistance.purchase).not.toHaveProperty('price');
    expect(response.body.assistance.purchase).not.toHaveProperty('serialNumber');
    expect(response.body.assistance.purchase).not.toHaveProperty('category');
    expect(Object.keys(response.body.assistance.warranty).sort()).toEqual(
      ['durationMonths', 'endDate', 'id', 'startDate'].sort(),
    );
    expect(response.body.assistance.warranty).not.toHaveProperty('purchaseId');
    expect(response.body.assistance.warranty).not.toHaveProperty('createdAt');
    expect(JSON.stringify(response.body)).not.toContain('SN-SECRET');
    expect(JSON.stringify(response.body)).not.toContain(user.id);
  });

  it('isola por usuário: cada um só inicia assistência das próprias compras', async () => {
    const { user: userA, token: tokenA } = await createUserWithToken();
    const { user: userB, token: tokenB } = await createUserWithToken();
    const purchaseA = await createPurchase(userA.id, { productName: 'Produto A' });
    const purchaseB = await createPurchase(userB.id, { productName: 'Produto B' });

    const responseA = await postAssistance(purchaseA.id, tokenA, { problem: validProblem });
    const responseB = await postAssistance(purchaseB.id, tokenB, { problem: validProblem });

    expect(responseA.status).toBe(200);
    expect(responseA.body.assistance.purchase.productName).toBe('Produto A');
    expect(responseB.status).toBe(200);
    expect(responseB.body.assistance.purchase.productName).toBe('Produto B');

    // Cross access is denied for both, regardless of who owns the purchase.
    const crossA = await postAssistance(purchaseB.id, tokenA, { problem: validProblem });
    const crossB = await postAssistance(purchaseA.id, tokenB, { problem: validProblem });
    expect(crossA.status).toBe(403);
    expect(crossB.status).toBe(403);
  });

  it('não confia em userId/purchaseId vindos do body (ownership usa request.userId)', async () => {
    const { user: userA, token: tokenA } = await createUserWithToken();
    const { user: userB } = await createUserWithToken();
    const purchaseB = await createPurchase(userB.id, { productName: 'Compra alheia' });

    // The route param is the attacker's own purchase, but the body tries to
    // point at someone else's. Strict body + request.userId make it impossible.
    const ownPurchase = await createPurchase(userA.id, { productName: 'Minha compra' });
    const response = await api()
      .post(`/purchases/${ownPurchase.id}/assistance`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ problem: validProblem, purchaseId: purchaseB.id, userId: userB.id });

    expect(response.status).toBe(400);
    expect(JSON.stringify(response.body)).not.toContain('Compra alheia');
  });

  describe('limites de data (UTC)', () => {
    it('startDate = hoje → ACTIVE', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);
      await createWarranty(purchase.id, daysFromToday(0), daysFromToday(30));

      const response = await postAssistance(purchase.id, token, { problem: validProblem });

      expect(response.status).toBe(200);
      expect(response.body.assistance.warrantyStatus).toBe('ACTIVE');
    });

    it('endDate = hoje → ACTIVE', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);
      await createWarranty(purchase.id, daysFromToday(-30), daysFromToday(0));

      const response = await postAssistance(purchase.id, token, { problem: validProblem });

      expect(response.status).toBe(200);
      expect(response.body.assistance.warrantyStatus).toBe('ACTIVE');
    });

    it('endDate = ontem → EXPIRED', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);
      await createWarranty(purchase.id, daysFromToday(-30), daysFromToday(-1));

      const response = await postAssistance(purchase.id, token, { problem: validProblem });

      expect(response.status).toBe(200);
      expect(response.body.assistance.warrantyStatus).toBe('EXPIRED');
    });

    it('startDate = amanhã → UPCOMING', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);
      await createWarranty(purchase.id, daysFromToday(1), daysFromToday(30));

      const response = await postAssistance(purchase.id, token, { problem: validProblem });

      expect(response.status).toBe(200);
      expect(response.body.assistance.warrantyStatus).toBe('UPCOMING');
    });
  });

  it('não persiste nada: nenhum registro de assistance é criado', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const before = {
      purchases: await testPrisma.purchase.count(),
      warranties: await testPrisma.warranty.count(),
      documents: await testPrisma.document.count(),
    };

    const response = await postAssistance(purchase.id, token, { problem: validProblem });
    expect(response.status).toBe(200);

    expect(await testPrisma.purchase.count()).toBe(before.purchases);
    expect(await testPrisma.warranty.count()).toBe(before.warranties);
    expect(await testPrisma.document.count()).toBe(before.documents);
  });

  it('não quebra os endpoints existentes (regressão)', async () => {
    const { token } = await createUserWithToken();
    const created = await api().post('/purchases').set('Authorization', `Bearer ${token}`).send({
      productName: 'Produto regressão',
      purchaseDate: '2026-09-10',
      price: 100,
      category: 'Eletrônicos',
    });
    expect(created.status).toBe(201);
    const purchaseId = created.body.purchase.id;

    // GET /purchases e GET /purchases/:id continuam intactos.
    const list = await api().get('/purchases').set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.purchases).toHaveLength(1);

    const detail = await api()
      .get(`/purchases/${purchaseId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.purchase).not.toHaveProperty('warranty');

    // Warranty endpoints continuam funcionando.
    const warrantyCreated = await api()
      .post(`/purchases/${purchaseId}/warranty`)
      .set('Authorization', `Bearer ${token}`)
      .send({ durationMonths: 12, startDate: '2026-09-10', endDate: '2027-09-10' });
    expect(warrantyCreated.status).toBe(201);

    const warrantyFetched = await api()
      .get(`/purchases/${purchaseId}/warranty`)
      .set('Authorization', `Bearer ${token}`);
    expect(warrantyFetched.status).toBe(200);

    // A nova rota de assistance continua respondendo após as demais.
    const assistance = await postAssistance(purchaseId, token, { problem: validProblem });
    expect(assistance.status).toBe(200);
    expect(assistance.body.assistance.warrantyStatus).toBe('ACTIVE');
  });
});
