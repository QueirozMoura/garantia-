import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { api, createUserWithToken } from './helpers/http.js';
import { cleanDatabase, disconnectDatabase, testPrisma } from './helpers/db.js';

const validPayload = () => ({
  productName: 'Geladeira Frost Free',
  brand: 'Brastemp',
  model: 'BRM44',
  serialNumber: 'SN-1234',
  store: 'Magazine Teste',
  purchaseDate: '2026-09-10',
  price: 2499.9,
  category: 'Geladeira',
});

describe('POST /purchases', () => {
  beforeAll(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
  });

  it('cria uma Purchase válida para o usuário autenticado', async () => {
    const { user, token } = await createUserWithToken();

    const response = await api()
      .post('/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload());

    expect(response.status).toBe(201);

    // Response follows the existing { purchase } shape of the purchases module.
    const { purchase } = response.body;
    expect(purchase).toMatchObject({
      productName: 'Geladeira Frost Free',
      brand: 'Brastemp',
      model: 'BRM44',
      serialNumber: 'SN-1234',
      store: 'Magazine Teste',
      price: '2499.90',
      category: 'Geladeira',
    });
    expect(purchase.id).toBeTypeOf('string');

    // Purchase belongs to the authenticated user and never echoes userId.
    expect(purchase.userId).toBeUndefined();

    // purchaseDate is persisted as UTC midnight (no timezone drift).
    expect(new Date(purchase.purchaseDate).toISOString()).toBe('2026-09-10T00:00:00.000Z');
    expect(user.id).toBeTypeOf('string');
  });

  it('rejeita requisição sem token com 401', async () => {
    const response = await api().post('/purchases').send(validPayload());

    expect(response.status).toBe(401);
  });

  it('rejeita productName ausente ou inválido com 400', async () => {
    const { token } = await createUserWithToken();

    const missing = await api()
      .post('/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPayload(), productName: undefined });

    expect(missing.status).toBe(400);

    const empty = await api()
      .post('/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPayload(), productName: '   ' });

    expect(empty.status).toBe(400);
  });

  it('rejeita purchaseDate inválida com 400', async () => {
    const { token } = await createUserWithToken();

    const response = await api()
      .post('/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPayload(), purchaseDate: '10/09/2026' });

    expect(response.status).toBe(400);
  });

  it('rejeita price negativo com 400', async () => {
    const { token } = await createUserWithToken();

    const response = await api()
      .post('/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPayload(), price: -1 });

    expect(response.status).toBe(400);
  });

  it('rejeita category ausente ou inválida com 400', async () => {
    const { token } = await createUserWithToken();

    const missing = await api()
      .post('/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPayload(), category: undefined });

    expect(missing.status).toBe(400);

    const empty = await api()
      .post('/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPayload(), category: '' });

    expect(empty.status).toBe(400);
  });

  it('não permite que campos internos alterem a propriedade da compra', async () => {
    const { user, token } = await createUserWithToken();
    const { user: otherUser } = await createUserWithToken();

    const countBefore = await testPrisma.purchase.count();

    const response = await api()
      .post('/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send({ ...validPayload(), userId: otherUser.id, id: 'hacked-id', createdAt: '2000-01-01' });

    // Unknown/internal keys are rejected outright by the strict schema.
    expect(response.status).toBe(400);

    // Nothing was created, so ownership cannot be forged.
    expect(await testPrisma.purchase.count()).toBe(countBefore);
    expect(user.id).not.toBe(otherUser.id);
  });

  it('aceita valores opcionais enviados como null', async () => {
    const { token } = await createUserWithToken();

    const response = await api()
      .post('/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send({
        ...validPayload(),
        brand: null,
        model: null,
        serialNumber: null,
        store: null,
      });

    expect(response.status).toBe(201);
    expect(response.body.purchase).toMatchObject({
      brand: null,
      model: null,
      serialNumber: null,
      store: null,
    });
  });

  it('persiste a Purchase no banco de teste', async () => {
    const { user, token } = await createUserWithToken();

    const response = await api()
      .post('/purchases')
      .set('Authorization', `Bearer ${token}`)
      .send(validPayload());

    expect(response.status).toBe(201);

    const persisted = await testPrisma.purchase.findUnique({
      where: { id: response.body.purchase.id },
    });

    expect(persisted).not.toBeNull();
    expect(persisted?.userId).toBe(user.id);
    expect(persisted?.productName).toBe('Geladeira Frost Free');
    expect(persisted?.brand).toBe('Brastemp');
    expect(persisted?.model).toBe('BRM44');
    expect(persisted?.serialNumber).toBe('SN-1234');
    expect(persisted?.store).toBe('Magazine Teste');
    expect(persisted?.price.toFixed(2)).toBe('2499.90');
    expect(persisted?.category).toBe('Geladeira');
    expect(persisted?.purchaseDate.toISOString()).toBe('2026-09-10T00:00:00.000Z');
  });
});
