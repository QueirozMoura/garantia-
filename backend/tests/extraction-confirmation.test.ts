import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api, createPurchaseWithDocument, createUserWithToken } from './helpers/http.js';
import { cleanDatabase, disconnectDatabase, testPrisma } from './helpers/db.js';

describe('PATCH /documents/:documentId/extraction', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  it('confirms a valid extraction and persists the updated purchase (no warranty)', async () => {
    const { user, token } = await createUserWithToken();
    const { purchase, document } = await createPurchaseWithDocument(user.id);

    const payload = {
      productName: 'Updated Product',
      brand: 'Updated Brand',
      model: 'Updated Model',
      purchaseDate: '2024-05-10',
      price: 259.9,
      store: 'Updated Store',
      warrantyMonths: null,
    };

    const response = await api()
      .patch(`/documents/${document.id}/extraction`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(response.status).toBe(200);

    // Response carries the updated purchase data.
    expect(response.body.purchase).toMatchObject({
      id: purchase.id,
      productName: 'Updated Product',
      brand: 'Updated Brand',
      model: 'Updated Model',
      store: 'Updated Store',
      price: '259.90',
    });
    expect(new Date(response.body.purchase.purchaseDate).toISOString()).toBe(
      '2024-05-10T00:00:00.000Z',
    );
    expect(response.body.warranty).toBeNull();

    // Verify persistence directly against the test database.
    const persisted = await testPrisma.purchase.findUnique({
      where: { id: purchase.id },
    });

    expect(persisted).not.toBeNull();
    expect(persisted?.productName).toBe('Updated Product');
    expect(persisted?.brand).toBe('Updated Brand');
    expect(persisted?.model).toBe('Updated Model');
    expect(persisted?.store).toBe('Updated Store');
    expect(persisted?.price.toFixed(2)).toBe('259.90');
    expect(persisted?.purchaseDate.toISOString()).toBe('2024-05-10T00:00:00.000Z');

    // No warranty must be created when warrantyMonths is null.
    const warranty = await testPrisma.warranty.findUnique({
      where: { purchaseId: purchase.id },
    });
    expect(warranty).toBeNull();
  });

  it('cria uma Warranty quando warrantyMonths é informado', async () => {
    const { user, token } = await createUserWithToken();
    const { purchase, document } = await createPurchaseWithDocument(user.id);

    const payload = {
      productName: 'Warranty Product',
      brand: 'Warranty Brand',
      model: 'Warranty Model',
      purchaseDate: '2024-05-10',
      price: 199.9,
      store: 'Warranty Store',
      warrantyMonths: 12,
    };

    const response = await api()
      .patch(`/documents/${document.id}/extraction`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(response.status).toBe(200);

    // Response carries the updated purchase data.
    expect(response.body.purchase).toMatchObject({
      id: purchase.id,
      productName: 'Warranty Product',
      brand: 'Warranty Brand',
      model: 'Warranty Model',
      store: 'Warranty Store',
      price: '199.90',
    });

    // Response carries the created warranty.
    expect(response.body.warranty).toMatchObject({
      purchaseId: purchase.id,
      durationMonths: 12,
    });

    // Verify persistence directly against the test database.
    const warranties = await testPrisma.warranty.findMany({
      where: { purchaseId: purchase.id },
    });

    expect(warranties).toHaveLength(1);

    const [warranty] = warranties;
    expect(warranty.durationMonths).toBe(12);
    expect(warranty.startDate.toISOString()).toBe('2024-05-10T00:00:00.000Z');
    expect(warranty.endDate.toISOString()).toBe('2025-05-10T00:00:00.000Z');
    expect(warranty.purchaseId).toBe(purchase.id);
  });

  it('atualiza uma Warranty existente quando warrantyMonths é informado', async () => {
    const { user, token } = await createUserWithToken();
    const { purchase, document } = await createPurchaseWithDocument(user.id);

    // Pre-existing warranty with clearly different values than the PATCH payload.
    const existingWarranty = await testPrisma.warranty.create({
      data: {
        purchaseId: purchase.id,
        durationMonths: 3,
        startDate: new Date('2020-01-01T00:00:00.000Z'),
        endDate: new Date('2020-04-01T00:00:00.000Z'),
      },
    });

    const payload = {
      productName: 'Updated Warranty Product',
      brand: 'Updated Warranty Brand',
      model: 'Updated Warranty Model',
      purchaseDate: '2024-05-10',
      price: 349.9,
      store: 'Updated Warranty Store',
      warrantyMonths: 24,
    };

    const response = await api()
      .patch(`/documents/${document.id}/extraction`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(response.status).toBe(200);

    // Response carries the updated warranty.
    expect(response.body.warranty).toMatchObject({
      id: existingWarranty.id,
      purchaseId: purchase.id,
      durationMonths: 24,
    });

    // Verify persistence directly against the test database.
    const warranties = await testPrisma.warranty.findMany({
      where: { purchaseId: purchase.id },
    });

    // Still exactly one warranty, updated in place (not a second one created).
    expect(warranties).toHaveLength(1);

    const [warranty] = warranties;
    expect(warranty.id).toBe(existingWarranty.id);
    expect(warranty.durationMonths).toBe(24);
    expect(warranty.startDate.toISOString()).toBe('2024-05-10T00:00:00.000Z');
    expect(warranty.endDate.toISOString()).toBe('2026-05-10T00:00:00.000Z');
    expect(warranty.purchaseId).toBe(purchase.id);
  });

  it('impede confirmação de extração em documento pertencente a outro usuário', async () => {
    const { user: owner } = await createUserWithToken();
    const { token: attackerToken } = await createUserWithToken();
    const { purchase, document } = await createPurchaseWithDocument(owner.id);

    const payload = {
      productName: 'Attacker Product',
      brand: 'Attacker Brand',
      model: 'Attacker Model',
      purchaseDate: '2024-05-10',
      price: 999.9,
      store: 'Attacker Store',
      warrantyMonths: 24,
    };

    const response = await api()
      .patch(`/documents/${document.id}/extraction`)
      .set('Authorization', `Bearer ${attackerToken}`)
      .send(payload);

    expect(response.status).toBe(403);

    // Error format adopted by the API.
    expect(response.body.error).toMatchObject({
      message: expect.any(String),
      code: 'DOCUMENT_ACCESS_DENIED',
    });

    // The purchase must remain completely untouched.
    const persisted = await testPrisma.purchase.findUnique({
      where: { id: purchase.id },
    });

    expect(persisted).not.toBeNull();
    expect(persisted).toMatchObject({
      productName: 'Original Product',
      brand: 'Original Brand',
      model: 'Original Model',
      store: 'Original Store',
    });
    expect(persisted?.price.toFixed(2)).toBe('100.00');
    expect(persisted?.purchaseDate.toISOString()).toBe('2024-01-01T00:00:00.000Z');

    // No warranty must be created or altered.
    const warranty = await testPrisma.warranty.findUnique({
      where: { purchaseId: purchase.id },
    });
    expect(warranty).toBeNull();

    // The document still belongs to the owner's purchase.
    const persistedDocument = await testPrisma.document.findUnique({
      where: { id: document.id },
    });
    expect(persistedDocument?.purchaseId).toBe(purchase.id);
  });

  it('retorna 404 para documento inexistente', async () => {
    const { token } = await createUserWithToken();

    // Syntactically valid UUID that does not exist in the test database.
    const nonExistentDocumentId = crypto.randomUUID();

    const purchaseCountBefore = await testPrisma.purchase.count();
    const warrantyCountBefore = await testPrisma.warranty.count();

    const payload = {
      productName: 'Ghost Product',
      brand: 'Ghost Brand',
      model: 'Ghost Model',
      purchaseDate: '2024-05-10',
      price: 123.45,
      store: 'Ghost Store',
      warrantyMonths: 12,
    };

    const response = await api()
      .patch(`/documents/${nonExistentDocumentId}/extraction`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    expect(response.status).toBe(404);

    // Not-found format adopted by the API for documents.
    expect(response.body.error).toMatchObject({
      message: expect.any(String),
      code: 'DOCUMENT_NOT_FOUND',
    });

    // No data must be created by the failed PATCH.
    const persistedDocument = await testPrisma.document.findUnique({
      where: { id: nonExistentDocumentId },
    });
    expect(persistedDocument).toBeNull();
    expect(await testPrisma.purchase.count()).toBe(purchaseCountBefore);
    expect(await testPrisma.warranty.count()).toBe(warrantyCountBefore);
  });

  it('retorna 404 para documentId com UUID inválido', async () => {
    const { token } = await createUserWithToken();

    const purchaseCountBefore = await testPrisma.purchase.count();
    const documentCountBefore = await testPrisma.document.count();
    const warrantyCountBefore = await testPrisma.warranty.count();

    const payload = {
      productName: 'Invalid Id Product',
      brand: 'Invalid Id Brand',
      model: 'Invalid Id Model',
      purchaseDate: '2024-05-10',
      price: 77.7,
      store: 'Invalid Id Store',
      warrantyMonths: 6,
    };

    const response = await api()
      .patch('/documents/not-a-uuid/extraction')
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    // The service maps Prisma's invalid-UUID error (P2023) to a not-found.
    expect(response.status).toBe(404);

    expect(response.body.error).toMatchObject({
      message: expect.any(String),
      code: 'DOCUMENT_NOT_FOUND',
    });

    // No data must be created or altered by the failed PATCH.
    expect(await testPrisma.purchase.count()).toBe(purchaseCountBefore);
    expect(await testPrisma.document.count()).toBe(documentCountBefore);
    expect(await testPrisma.warranty.count()).toBe(warrantyCountBefore);
  });

  it('rejeita payload inválido sem alterar a Purchase ou criar Warranty', async () => {
    const { user, token } = await createUserWithToken();
    const { purchase, document } = await createPurchaseWithDocument(user.id);

    // Snapshot of the current state before the PATCH.
    const before = await testPrisma.purchase.findUniqueOrThrow({
      where: { id: purchase.id },
    });
    const warrantyBefore = await testPrisma.warranty.findUnique({
      where: { purchaseId: purchase.id },
    });
    const documentBefore = await testPrisma.document.findUniqueOrThrow({
      where: { id: document.id },
    });

    // productName empty violates the schema's min(1) rule.
    const payload = {
      productName: '',
      brand: 'Invalid Brand',
      model: 'Invalid Model',
      purchaseDate: '2024-05-10',
      price: 321.1,
      store: 'Invalid Store',
      warrantyMonths: 12,
    };

    const response = await api()
      .patch(`/documents/${document.id}/extraction`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

    // Validation must happen before any persistence.
    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
    });
    expect(response.body.error.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'productName' })]),
    );

    // The purchase must remain exactly as it was before.
    const after = await testPrisma.purchase.findUniqueOrThrow({
      where: { id: purchase.id },
    });
    expect(after).toEqual(before);

    // No warranty was created or altered.
    const warrantyAfter = await testPrisma.warranty.findUnique({
      where: { purchaseId: purchase.id },
    });
    expect(warrantyAfter).toEqual(warrantyBefore);
    expect(warrantyAfter).toBeNull();

    // The document remains intact.
    const documentAfter = await testPrisma.document.findUniqueOrThrow({
      where: { id: document.id },
    });
    expect(documentAfter).toEqual(documentBefore);
  });
});
