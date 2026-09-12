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

const createDocument = async (
  purchaseId: string,
  overrides: Partial<{
    name: string;
    fileName: string;
    mimeType: string;
    size: number;
    type: 'INVOICE' | 'RECEIPT' | 'WARRANTY' | 'OTHER';
    createdAt: Date;
  }> = {},
) =>
  testPrisma.document.create({
    data: {
      purchaseId,
      name: overrides.name ?? 'Nota fiscal',
      fileName: overrides.fileName ?? `${crypto.randomUUID()}.pdf`,
      mimeType: overrides.mimeType ?? 'application/pdf',
      size: overrides.size ?? 123456,
      storagePath: `${crypto.randomUUID()}.pdf`,
      type: overrides.type ?? 'INVOICE',
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    },
  });

const getDocuments = (token: string) =>
  api().get('/documents').set('Authorization', `Bearer ${token}`);

describe('GET /documents', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  it('retorna 401 AUTH_REQUIRED sem autenticação', async () => {
    const response = await api().get('/documents');

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: {
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
      },
    });
  });

  it('retorna lista vazia (200) para um usuário sem documentos', async () => {
    const { token } = await createUserWithToken();

    const response = await getDocuments(token);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ documents: [] });
  });

  it('retorna apenas os documentos das compras do usuário autenticado', async () => {
    const { token: tokenA, user: userA } = await createUserWithToken();
    const { user: userB } = await createUserWithToken();

    const purchaseA = await createPurchase(userA.id, { productName: 'Produto A' });
    const purchaseB = await createPurchase(userB.id, { productName: 'Produto B' });

    const documentA = await createDocument(purchaseA.id, { name: 'Doc A' });
    await createDocument(purchaseB.id, { name: 'Doc B' });

    const response = await getDocuments(tokenA);

    expect(response.status).toBe(200);
    expect(response.body.documents).toHaveLength(1);
    expect(response.body.documents[0].id).toBe(documentA.id);
    expect(response.body.documents[0].purchaseId).toBe(purchaseA.id);
  });

  it('inclui os dados públicos da compra e não vaza userId nem price', async () => {
    const { token, user } = await createUserWithToken();

    const purchase = await createPurchase(user.id, {
      productName: 'Notebook',
      brand: 'Dell',
      model: 'Inspiron',
      category: 'Informática',
      purchaseDate: new Date('2026-09-04T00:00:00.000Z'),
    });
    const document = await createDocument(purchase.id, {
      name: 'Nota fiscal',
      fileName: 'uuid.pdf',
      mimeType: 'application/pdf',
      size: 123456,
      type: 'INVOICE',
    });

    const response = await getDocuments(token);

    expect(response.status).toBe(200);
    expect(response.body.documents).toHaveLength(1);

    const [item] = response.body.documents;
    expect(item).toMatchObject({
      id: document.id,
      purchaseId: purchase.id,
      name: 'Nota fiscal',
      fileName: 'uuid.pdf',
      mimeType: 'application/pdf',
      size: 123456,
      type: 'INVOICE',
    });
    expect(item.createdAt).toBeTruthy();
    expect(item.updatedAt).toBeTruthy();

    // Document fields must be exactly the public contract (no storagePath, etc).
    expect(Object.keys(item).sort()).toEqual(
      [
        'createdAt',
        'fileName',
        'id',
        'mimeType',
        'name',
        'purchase',
        'purchaseId',
        'size',
        'type',
        'updatedAt',
      ].sort(),
    );

    // Related purchase exposes only the public summary.
    expect(item.purchase).toEqual({
      id: purchase.id,
      productName: 'Notebook',
      brand: 'Dell',
      model: 'Inspiron',
      purchaseDate: '2026-09-04T00:00:00.000Z',
      category: 'Informática',
    });
    expect(Object.keys(item.purchase).sort()).toEqual(
      ['brand', 'category', 'id', 'model', 'productName', 'purchaseDate'].sort(),
    );
    expect(item.purchase).not.toHaveProperty('userId');
    expect(item.purchase).not.toHaveProperty('price');
  });

  it('ordena por createdAt desc (mais recente primeiro)', async () => {
    const { token, user } = await createUserWithToken();

    const purchase = await createPurchase(user.id);

    const oldest = await createDocument(purchase.id, {
      name: 'Antigo',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    });
    const newest = await createDocument(purchase.id, {
      name: 'Recente',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    const middle = await createDocument(purchase.id, {
      name: 'Meio',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    });

    const response = await getDocuments(token);

    expect(response.status).toBe(200);
    const ids = response.body.documents.map((document: { id: string }) => document.id);
    expect(ids).toEqual([newest.id, middle.id, oldest.id]);
  });

  it('isola os documentos por usuário: cada um só enxerga os próprios', async () => {
    const { token: tokenA, user: userA } = await createUserWithToken();
    const { token: tokenB, user: userB } = await createUserWithToken();

    const purchaseA = await createPurchase(userA.id, { productName: 'Produto A' });
    const purchaseB = await createPurchase(userB.id, { productName: 'Produto B' });

    const documentA = await createDocument(purchaseA.id);
    const documentB = await createDocument(purchaseB.id);

    const responseA = await getDocuments(tokenA);
    const responseB = await getDocuments(tokenB);

    expect(responseA.status).toBe(200);
    expect(responseB.status).toBe(200);

    expect(responseA.body.documents).toHaveLength(1);
    expect(responseA.body.documents[0].id).toBe(documentA.id);
    expect(responseA.body.documents[0].purchase.productName).toBe('Produto A');
    expect(responseA.body.documents.map((document: { id: string }) => document.id)).not.toContain(
      documentB.id,
    );

    expect(responseB.body.documents).toHaveLength(1);
    expect(responseB.body.documents[0].id).toBe(documentB.id);
    expect(responseB.body.documents[0].purchase.productName).toBe('Produto B');
    expect(responseB.body.documents.map((document: { id: string }) => document.id)).not.toContain(
      documentA.id,
    );
  });

  it('ignora userId vindo do cliente (query/body/header) e usa apenas o token', async () => {
    const { token: tokenA, user: userA } = await createUserWithToken();
    const { user: userB } = await createUserWithToken();

    const purchaseA = await createPurchase(userA.id, { productName: 'Produto A' });
    const purchaseB = await createPurchase(userB.id, { productName: 'Produto B' });

    await createDocument(purchaseA.id, { name: 'Doc A' });
    await createDocument(purchaseB.id, { name: 'Doc B' });

    // Attempt to read user B's documents while authenticated as user A.
    const response = await api()
      .get(`/documents?userId=${userB.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .set('x-user-id', userB.id);

    expect(response.status).toBe(200);
    expect(response.body.documents).toHaveLength(1);
    expect(response.body.documents[0].purchase.productName).toBe('Produto A');
  });

  it('não quebra as rotas existentes de documentos por compra e por id', async () => {
    const { token, user } = await createUserWithToken();
    const purchase = await createPurchase(user.id, { productName: 'Produto' });
    const document = await createDocument(purchase.id, { name: 'Doc regressão' });

    // GET /purchases/:purchaseId/documents
    const perPurchase = await api()
      .get(`/purchases/${purchase.id}/documents`)
      .set('Authorization', `Bearer ${token}`);
    expect(perPurchase.status).toBe(200);
    expect(perPurchase.body.documents).toHaveLength(1);
    expect(perPurchase.body.documents[0].id).toBe(document.id);

    // GET /documents/:documentId (download)
    const download = await api()
      .get(`/documents/${document.id}`)
      .set('Authorization', `Bearer ${token}`);
    // The file does not exist on disk, but the route must still resolve to the
    // service (404 file-not-found) and NOT be swallowed by the general list route.
    expect(download.status).toBe(404);

    // DELETE /documents/:documentId
    const removal = await api()
      .delete(`/documents/${document.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(removal.status).toBe(204);
    const deleted = await testPrisma.document.findUnique({
      where: { id: document.id },
    });
    expect(deleted).toBeNull();
  });
});
