import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api, createUserWithToken } from './helpers/http.js';
import { cleanDatabase, disconnectDatabase, testPrisma } from './helpers/db.js';

type PurchaseOverrides = {
  productName?: string;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  store?: string | null;
  purchaseDate?: Date;
  price?: string;
  category?: string;
  createdAt?: Date;
};

const createPurchase = async (userId: string, overrides: PurchaseOverrides = {}) =>
  testPrisma.purchase.create({
    data: {
      userId,
      productName: overrides.productName ?? 'Produto',
      brand: overrides.brand ?? 'Marca',
      model: overrides.model ?? 'Modelo',
      serialNumber: overrides.serialNumber ?? 'SN-0001',
      store: overrides.store ?? 'Loja',
      purchaseDate: overrides.purchaseDate ?? new Date('2026-09-10T00:00:00.000Z'),
      price: overrides.price ?? '3299.90',
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

const getPurchases = (token: string) =>
  api().get('/purchases').set('Authorization', `Bearer ${token}`);

// The purchase fields that existed before warranty was embedded. They must keep
// being returned exactly as before.
const purchaseFields = [
  'brand',
  'category',
  'createdAt',
  'id',
  'model',
  'price',
  'productName',
  'purchaseDate',
  'serialNumber',
  'store',
  'updatedAt',
  'warranty',
];

describe('GET /purchases', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  it('continua exigindo autenticação (401 AUTH_REQUIRED)', async () => {
    const response = await api().get('/purchases');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      },
    });
  });

  it('retorna lista vazia (200) para um usuário sem compras', async () => {
    const { token } = await createUserWithToken();

    const response = await getPurchases(token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ purchases: [] });
  });

  it('retorna warranty: null para compra sem garantia', async () => {
    const { token, user } = await createUserWithToken();

    const purchase = await createPurchase(user.id, { productName: 'Sem garantia' });

    const response = await getPurchases(token);

    expect(response.status).toBe(200);
    expect(response.body.purchases).toHaveLength(1);
    expect(response.body.purchases[0].warranty).toBeNull();
    expect(response.body.purchases[0].productName).toBe('Sem garantia');
    expect(response.body.purchases[0].id).toBe(purchase.id);
  });

  it('retorna os dados da garantia da compra', async () => {
    const { token, user } = await createUserWithToken();

    const purchase = await createPurchase(user.id, { productName: 'Com garantia' });
    const startDate = new Date('2026-09-10T00:00:00.000Z');
    const endDate = new Date('2027-09-10T00:00:00.000Z');
    const warranty = await createWarranty(purchase.id, startDate, endDate);

    const response = await getPurchases(token);

    expect(response.status).toBe(200);
    expect(response.body.purchases).toHaveLength(1);

    const [item] = response.body.purchases;
    expect(item.warranty).toMatchObject({
      id: warranty.id,
      durationMonths: 12,
    });
    // durationMonths permanece número inteiro.
    expect(Number.isInteger(item.warranty.durationMonths)).toBe(true);
    // Datas serializadas no mesmo padrão dos endpoints de warranty.
    expect(new Date(item.warranty.startDate).toISOString()).toBe(startDate.toISOString());
    expect(new Date(item.warranty.endDate).toISOString()).toBe(endDate.toISOString());
  });

  it('expõe somente id, durationMonths, startDate e endDate na garantia', async () => {
    const { token, user } = await createUserWithToken();

    const purchase = await createPurchase(user.id);
    await createWarranty(
      purchase.id,
      new Date('2026-09-10T00:00:00.000Z'),
      new Date('2027-09-10T00:00:00.000Z'),
    );

    const response = await getPurchases(token);

    const [item] = response.body.purchases;
    expect(Object.keys(item.warranty).sort()).toEqual(
      ['durationMonths', 'endDate', 'id', 'startDate'].sort(),
    );
    // Nenhum dado derivado de status é calculado nesta etapa.
    expect(item.warranty).not.toHaveProperty('status');
    expect(item.warranty).not.toHaveProperty('daysRemaining');
    expect(item.warranty).not.toHaveProperty('isActive');
    expect(item.warranty).not.toHaveProperty('isExpired');
    // Nem campos internos/relacionais.
    expect(item.warranty).not.toHaveProperty('purchaseId');
    expect(item.warranty).not.toHaveProperty('createdAt');
    expect(item.warranty).not.toHaveProperty('updatedAt');
  });

  it('mantém os campos antigos da Purchase e nunca vaza userId', async () => {
    const { token, user } = await createUserWithToken();

    await createPurchase(user.id);

    const response = await getPurchases(token);

    const [item] = response.body.purchases;
    expect(Object.keys(item).sort()).toEqual([...purchaseFields].sort());
    expect(item).not.toHaveProperty('userId');
    expect(item).not.toHaveProperty('documents');
    expect(item.price).toBe('3299.90');
  });

  it('retorna uma compra com garantia e outra sem garantia para o mesmo usuário', async () => {
    const { token, user } = await createUserWithToken();

    const withWarranty = await createPurchase(user.id, { productName: 'Com' });
    await createPurchase(user.id, { productName: 'Sem' });
    await createWarranty(
      withWarranty.id,
      new Date('2026-09-10T00:00:00.000Z'),
      new Date('2027-09-10T00:00:00.000Z'),
    );

    const response = await getPurchases(token);

    expect(response.status).toBe(200);
    expect(response.body.purchases).toHaveLength(2);

    const byName = new Map<string, { warranty: unknown }>(
      response.body.purchases.map((purchase: { productName: string; warranty: unknown }) => [
        purchase.productName,
        purchase,
      ]),
    );

    expect(byName.get('Com')?.warranty).not.toBeNull();
    expect(byName.get('Sem')?.warranty).toBeNull();
  });

  it('nunca retorna a garantia de outro usuário', async () => {
    const { token: tokenA, user: userA } = await createUserWithToken();
    const { token: tokenB, user: userB } = await createUserWithToken();

    const purchaseA = await createPurchase(userA.id, { productName: 'Produto A' });
    const purchaseB = await createPurchase(userB.id, { productName: 'Produto B' });
    const warrantyB = await createWarranty(
      purchaseB.id,
      new Date('2026-09-10T00:00:00.000Z'),
      new Date('2028-09-10T00:00:00.000Z'),
    );

    const responseA = await getPurchases(tokenA);
    const responseB = await getPurchases(tokenB);

    expect(responseA.status).toBe(200);
    expect(responseA.body.purchases).toHaveLength(1);
    expect(responseA.body.purchases[0].id).toBe(purchaseA.id);
    // O usuário A não enxerga a compra nem a garantia do usuário B.
    expect(responseA.body.purchases[0].warranty).toBeNull();
    expect(JSON.stringify(responseA.body)).not.toContain(warrantyB.id);

    expect(responseB.body.purchases).toHaveLength(1);
    expect(responseB.body.purchases[0].warranty.id).toBe(warrantyB.id);
  });

  it('ignora userId vindo de query string (ownership segue request.userId)', async () => {
    const { token: tokenA, user: userA } = await createUserWithToken();
    const { user: userB } = await createUserWithToken();

    await createPurchase(userA.id, { productName: 'Minha compra' });
    const purchaseB = await createPurchase(userB.id, { productName: 'Compra alheia' });
    await createWarranty(
      purchaseB.id,
      new Date('2026-09-10T00:00:00.000Z'),
      new Date('2028-09-10T00:00:00.000Z'),
    );

    const response = await api()
      .get(`/purchases?userId=${userB.id}`)
      .set('Authorization', `Bearer ${tokenA}`);

    expect(response.status).toBe(200);
    expect(response.body.purchases).toHaveLength(1);
    expect(response.body.purchases[0].productName).toBe('Minha compra');
    expect(JSON.stringify(response.body)).not.toContain('Compra alheia');
  });

  it('mantém a ordenação por createdAt desc', async () => {
    const { token, user } = await createUserWithToken();

    // createPurchase insere em ordem, então a lista deve voltar invertida.
    await createPurchase(user.id, {
      productName: 'Mais antiga',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    });
    await createPurchase(user.id, {
      productName: 'Intermediária',
      createdAt: new Date('2024-06-01T00:00:00.000Z'),
    });
    await createPurchase(user.id, {
      productName: 'Mais recente',
      createdAt: new Date('2024-12-01T00:00:00.000Z'),
    });

    const response = await getPurchases(token);

    expect(response.status).toBe(200);
    const names = response.body.purchases.map(
      (purchase: { productName: string }) => purchase.productName,
    );
    expect(names).toEqual(['Mais recente', 'Intermediária', 'Mais antiga']);
  });

  it('não altera criar/editar/excluir compra e não adiciona warranty nesses endpoints', async () => {
    const { token } = await createUserWithToken();

    const created = await api().post('/purchases').set('Authorization', `Bearer ${token}`).send({
      productName: 'Ciclo de vida',
      brand: 'Marca',
      model: 'Modelo',
      serialNumber: 'SN-1',
      store: 'Loja',
      purchaseDate: '2026-09-10',
      price: 3299.9,
      category: 'Eletrônicos',
    });

    expect(created.status).toBe(201);
    expect(created.body.purchase.productName).toBe('Ciclo de vida');
    expect(created.body.purchase.price).toBe('3299.90');
    // Fora do escopo desta etapa: POST /purchases mantém o contrato anterior.
    expect(created.body.purchase).not.toHaveProperty('warranty');
    const purchaseId = created.body.purchase.id;

    const updated = await api()
      .put(`/purchases/${purchaseId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ productName: 'Ciclo de vida atualizado' });

    expect(updated.status).toBe(200);
    expect(updated.body.purchase.productName).toBe('Ciclo de vida atualizado');
    // Fora do escopo desta etapa: PUT /purchases/:id mantém o contrato anterior.
    expect(updated.body.purchase).not.toHaveProperty('warranty');

    const removed = await api()
      .delete(`/purchases/${purchaseId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(removed.status).toBe(204);

    const afterDelete = await getPurchases(token);
    expect(afterDelete.body.purchases).toEqual([]);
  });

  it('GET /purchases/:id mantém o contrato anterior, sem warranty', async () => {
    const { token, user } = await createUserWithToken();

    const purchase = await createPurchase(user.id, { productName: 'Detalhe' });
    // Mesmo com garantia existente, o endpoint individual não deve expô-la.
    await createWarranty(
      purchase.id,
      new Date('2026-09-10T00:00:00.000Z'),
      new Date('2027-09-10T00:00:00.000Z'),
    );

    const response = await api()
      .get(`/purchases/${purchase.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(response.body.purchase.productName).toBe('Detalhe');
    expect(response.body.purchase).not.toHaveProperty('warranty');
    expect(response.body.purchase).not.toHaveProperty('userId');
    expect(response.body.purchase).not.toHaveProperty('documents');
    expect(Object.keys(response.body.purchase).sort()).toEqual(
      [
        'brand',
        'category',
        'createdAt',
        'id',
        'model',
        'price',
        'productName',
        'purchaseDate',
        'serialNumber',
        'store',
        'updatedAt',
      ].sort(),
    );

    // A garantia continua acessível pela rota dedicada.
    const warrantyResponse = await api()
      .get(`/purchases/${purchase.id}/warranty`)
      .set('Authorization', `Bearer ${token}`);

    expect(warrantyResponse.status).toBe(200);
  });

  it('não quebra os endpoints de warranty por compra', async () => {
    const { token, user } = await createUserWithToken();

    const purchase = await createPurchase(user.id, { productName: 'Com rota de garantia' });

    const created = await api()
      .post(`/purchases/${purchase.id}/warranty`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        durationMonths: 12,
        startDate: '2026-09-10',
        endDate: '2027-09-10',
      });

    expect(created.status).toBe(201);
    const warrantyId = created.body.warranty.id;

    const fetched = await api()
      .get(`/purchases/${purchase.id}/warranty`)
      .set('Authorization', `Bearer ${token}`);

    expect(fetched.status).toBe(200);
    expect(fetched.body.warranty.id).toBe(warrantyId);

    // A garantia criada pela rota aparece embutida SOMENTE na listagem.
    const list = await getPurchases(token);
    expect(list.body.purchases[0].warranty).toMatchObject({
      id: warrantyId,
      durationMonths: 12,
    });

    // GET /purchases/:id continua sem warranty, mesmo com a garantia existindo.
    const detail = await api()
      .get(`/purchases/${purchase.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(detail.status).toBe(200);
    expect(detail.body.purchase).not.toHaveProperty('warranty');

    // PUT /purchases/:id também continua sem warranty.
    const updated = await api()
      .put(`/purchases/${purchase.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ productName: 'Nome atualizado' });
    expect(updated.status).toBe(200);
    expect(updated.body.purchase).not.toHaveProperty('warranty');

    const removed = await api()
      .delete(`/purchases/${purchase.id}/warranty`)
      .set('Authorization', `Bearer ${token}`);

    expect(removed.status).toBe(204);

    const listAfterDelete = await getPurchases(token);
    expect(listAfterDelete.body.purchases[0].warranty).toBeNull();
  });

  it('carrega as garantias sem N+1: o nº de statements não cresce com as compras', async () => {
    const { token, user } = await createUserWithToken();

    // 3 compras, todas com garantia.
    for (let index = 0; index < 3; index += 1) {
      const purchase = await createPurchase(user.id, { productName: `Produto ${index}` });
      await createWarranty(
        purchase.id,
        new Date('2026-09-10T00:00:00.000Z'),
        new Date('2027-09-10T00:00:00.000Z'),
      );
    }

    // O cliente de testes não loga queries e o app não expõe contagem de
    // round-trips, então a checagem roda o MESMO select que o serviço usa
    // diretamente no banco, com um cliente que loga as statements emitidas.
    // A relação é resolvida pelo Prisma em uma única consulta: garantir que o
    // SQL de Purchase não se multiplica é a prova de ausência de N+1.
    const logged: string[] = [];
    const loggingClient = new PrismaClient({ log: [{ emit: 'event', level: 'query' }] });
    loggingClient.$on('query', (event) => logged.push(event.query));

    let purchases: { warranty: unknown }[];
    try {
      purchases = await loggingClient.purchase.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          productName: true,
          brand: true,
          model: true,
          serialNumber: true,
          store: true,
          purchaseDate: true,
          price: true,
          category: true,
          createdAt: true,
          updatedAt: true,
          warranty: {
            select: { id: true, durationMonths: true, startDate: true, endDate: true },
          },
        },
      });
    } finally {
      await loggingClient.$disconnect();
    }

    const checkPurchaseQueries = logged.filter((query) => query.includes('"Purchase"'));
    const warrantyQueries = logged.filter((query) => query.includes('"Warranty"'));

    // 3 compras, todas com garantia — carregadas em uma só ida ao banco.
    expect(purchases).toHaveLength(3);
    expect(purchases.every((purchase) => !!purchase.warranty)).toBe(true);
    expect(checkPurchaseQueries).toHaveLength(1);
    expect(warrantyQueries).toHaveLength(1);

    // E a rota HTTP realmente devolve a garantia embutida nas 3 compras.
    const response = await getPurchases(token);

    expect(response.status).toBe(200);
    expect(response.body.purchases).toHaveLength(3);
    expect(
      response.body.purchases.every((purchase: { warranty: unknown }) => !!purchase.warranty),
    ).toBe(true);
  });
});
