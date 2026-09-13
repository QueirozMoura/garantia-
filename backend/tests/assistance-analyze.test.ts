import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { cleanDatabase, disconnectDatabase, testPrisma } from './helpers/db.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

// Records what the backend sends to the AI so tests can assert the warranty
// status is computed by the backend and forwarded (never recalculated by AI).
let capturedInput: Record<string, unknown> | null = null;

// The provider used by the mocked `getAIProvider`. Tests can swap `nextResponse`
// to simulate valid or invalid AI answers without any real network call.
type ProviderResponse = { kind: 'value'; value: unknown } | { kind: 'throw'; error: Error };
let nextResponse: ProviderResponse = {
  kind: 'value',
  value: {
    summary: 'Resumo do problema.',
    possibleCauses: ['Causa possível A.', 'Causa possível B.'],
    recommendedAction: 'Procure assistência técnica autorizada.',
    safetyNote: 'Evite desmontar o equipamento.',
    warrantyGuidance: 'Consulte os canais autorizados.',
    requiredDocuments: [
      'Nota fiscal ou comprovante de compra',
      'Documento de garantia, se disponível',
    ],
  },
};

const validAnalysis = {
  summary: 'Resumo do problema.',
  possibleCauses: ['Causa possível A.', 'Causa possível B.'],
  recommendedAction: 'Procure assistência técnica autorizada.',
  safetyNote: 'Evite desmontar o equipamento.',
  warrantyGuidance: 'Consulte os canais autorizados.',
  requiredDocuments: [
    'Nota fiscal ou comprovante de compra',
    'Documento de garantia, se disponível',
  ],
};

type ApiClient = ReturnType<typeof import('./helpers/http.js').api>;

let api: () => ApiClient;
let createUserWithToken: typeof import('./helpers/http.js').createUserWithToken;

const postAnalyze = (purchaseId: string, token: string, body: unknown) =>
  api()
    .post(`/purchases/${purchaseId}/assistance/analyze`)
    .set('Authorization', `Bearer ${token}`)
    .send(body as object);

const validProblem = 'A máquina de lavar não está centrifugando.';

describe('POST /purchases/:purchaseId/assistance/analyze', () => {
  beforeAll(async () => {
    await cleanDatabase();

    // Replace only `getAIProvider` in the real ai.service module, so the real
    // `analyzeAssistance` (Zod validation + error mapping) still runs.
    vi.resetModules();
    vi.doMock('../src/services/ai/ai.service.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/services/ai/ai.service.js')>();
      return {
        ...actual,
        getAIProvider: () => ({
          extractPurchaseData: async () => ({}),
          analyzeAssistance: async (input: Record<string, unknown>) => {
            capturedInput = input;
            if (nextResponse.kind === 'throw') throw nextResponse.error;
            return nextResponse.value;
          },
        }),
      };
    });

    // Import app + helper AFTER the mock so the mocked provider is used.
    const { app } = await import('../src/app.js');
    const request = (await import('supertest')).default;
    api = () => request(app);
    const httpHelpers = await import('./helpers/http.js');
    createUserWithToken = httpHelpers.createUserWithToken;
  });

  afterEach(() => {
    capturedInput = null;
    nextResponse = { kind: 'value', value: validAnalysis };
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
    vi.doUnmock('../src/services/ai/ai.service.js');
    vi.resetModules();
  });

  it('sem autenticação → 401 AUTH_REQUIRED', async () => {
    const response = await api()
      .post(`/purchases/${crypto.randomUUID()}/assistance/analyze`)
      .send({ problem: validProblem });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({
      error: { message: 'Authentication required', code: 'AUTH_REQUIRED' },
    });
  });

  it('purchaseId inválido → 400 INVALID_PURCHASE_ID (sem chamar a IA)', async () => {
    const { token } = await createUserWithToken();

    const response = await postAnalyze('not-a-uuid', token, { problem: validProblem });

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: { message: 'Invalid purchase ID', code: 'INVALID_PURCHASE_ID' },
    });
    expect(capturedInput).toBeNull();
  });

  it('body inválido (problem ausente) → 400 VALIDATION_ERROR (sem chamar a IA)', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const response = await postAnalyze(purchase.id, token, {});

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(capturedInput).toBeNull();
  });

  it('problem menor que 5 caracteres → 400', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const response = await postAnalyze(purchase.id, token, { problem: 'abcd' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('problem maior que 2000 caracteres → 400', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const response = await postAnalyze(purchase.id, token, { problem: 'a'.repeat(2001) });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('campos extras no body → 400 (objeto estrito)', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const response = await postAnalyze(purchase.id, token, {
      problem: validProblem,
      warrantyStatus: 'ACTIVE',
      userId: crypto.randomUUID(),
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(capturedInput).toBeNull();
  });

  it('compra inexistente → 404 PURCHASE_NOT_FOUND', async () => {
    const { token } = await createUserWithToken();

    const response = await postAnalyze(crypto.randomUUID(), token, { problem: validProblem });

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { message: 'Purchase not found', code: 'PURCHASE_NOT_FOUND' },
    });
  });

  it('compra de outro usuário → 403 PURCHASE_ACCESS_DENIED (sem chamar a IA)', async () => {
    const { user: owner } = await createUserWithToken();
    const { token: otherToken } = await createUserWithToken();
    const purchase = await createPurchase(owner.id);

    const response = await postAnalyze(purchase.id, otherToken, { problem: validProblem });

    expect(response.status).toBe(403);
    expect(response.body).toEqual({
      error: {
        message: 'You do not have access to this purchase',
        code: 'PURCHASE_ACCESS_DENIED',
      },
    });
    expect(capturedInput).toBeNull();
  });

  it('compra com garantia ACTIVE → 200 com análise válida e status ACTIVE enviado à IA', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id, {
      productName: 'Geladeira',
      serialNumber: 'SN-SECRET',
      price: '4999.90',
    });
    await createWarranty(purchase.id, daysFromToday(-10), daysFromToday(10));

    const response = await postAnalyze(purchase.id, token, { problem: validProblem });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ analysis: validAnalysis });
    expect(capturedInput?.warrantyStatus).toBe('ACTIVE');
    // Only the agreed context is sent; internal data never leaves the backend.
    expect(capturedInput).not.toHaveProperty('userId');
    expect(capturedInput).not.toHaveProperty('price');
    expect(capturedInput).not.toHaveProperty('serialNumber');
    expect(JSON.stringify(capturedInput)).not.toContain('SN-SECRET');
  });

  it('compra com garantia EXPIRED → status EXPIRED enviado à IA', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);
    await createWarranty(purchase.id, daysFromToday(-40), daysFromToday(-1));

    const response = await postAnalyze(purchase.id, token, { problem: validProblem });

    expect(response.status).toBe(200);
    expect(capturedInput?.warrantyStatus).toBe('EXPIRED');
  });

  it('compra com garantia UPCOMING → status UPCOMING enviado à IA', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);
    await createWarranty(purchase.id, daysFromToday(1), daysFromToday(30));

    const response = await postAnalyze(purchase.id, token, { problem: validProblem });

    expect(response.status).toBe(200);
    expect(capturedInput?.warrantyStatus).toBe('UPCOMING');
  });

  it('compra sem garantia → status NONE e datas nulas enviadas à IA', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const response = await postAnalyze(purchase.id, token, { problem: validProblem });

    expect(response.status).toBe(200);
    expect(capturedInput?.warrantyStatus).toBe('NONE');
    expect(capturedInput?.warrantyStartDate).toBeNull();
    expect(capturedInput?.warrantyEndDate).toBeNull();
  });

  it('provider mockado retornando resposta válida → 200 com o schema exato', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const response = await postAnalyze(purchase.id, token, { problem: validProblem });

    expect(response.status).toBe(200);
    expect(Object.keys(response.body.analysis).sort()).toEqual(
      [
        'possibleCauses',
        'recommendedAction',
        'requiredDocuments',
        'safetyNote',
        'summary',
        'warrantyGuidance',
      ].sort(),
    );
    expect(response.body.analysis.possibleCauses).toHaveLength(2);
  });

  it('resposta válida com requiredDocuments → 200 preservando os documentos', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    nextResponse = {
      kind: 'value',
      value: {
        ...validAnalysis,
        requiredDocuments: [
          'Nota fiscal ou comprovante de compra',
          'Comprovante de pagamento',
          'Número de série ou etiqueta do produto',
        ],
      },
    };

    const response = await postAnalyze(purchase.id, token, { problem: validProblem });

    expect(response.status).toBe(200);
    expect(response.body.analysis.requiredDocuments).toEqual([
      'Nota fiscal ou comprovante de compra',
      'Comprovante de pagamento',
      'Número de série ou etiqueta do produto',
    ]);
  });

  it('requiredDocuments vazio → 503 AI_INVALID_RESPONSE', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    nextResponse = {
      kind: 'value',
      value: { ...validAnalysis, requiredDocuments: [] },
    };

    const response = await postAnalyze(purchase.id, token, { problem: validProblem });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('requiredDocuments ausente → 503 AI_INVALID_RESPONSE', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    nextResponse = {
      kind: 'value',
      value: {
        summary: validAnalysis.summary,
        possibleCauses: validAnalysis.possibleCauses,
        recommendedAction: validAnalysis.recommendedAction,
        safetyNote: validAnalysis.safetyNote,
        warrantyGuidance: validAnalysis.warrantyGuidance,
      },
    };

    const response = await postAnalyze(purchase.id, token, { problem: validProblem });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('mais de 5 documentos → 503 AI_INVALID_RESPONSE', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    nextResponse = {
      kind: 'value',
      value: {
        ...validAnalysis,
        requiredDocuments: ['Doc 1', 'Doc 2', 'Doc 3', 'Doc 4', 'Doc 5', 'Doc 6'],
      },
    };

    const response = await postAnalyze(purchase.id, token, { problem: validProblem });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('item vazio em requiredDocuments → 503 AI_INVALID_RESPONSE', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    nextResponse = {
      kind: 'value',
      value: {
        ...validAnalysis,
        requiredDocuments: ['Nota fiscal ou comprovante de compra', '   '],
      },
    };

    const response = await postAnalyze(purchase.id, token, { problem: validProblem });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('item acima de 200 caracteres em requiredDocuments → 503 AI_INVALID_RESPONSE', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    nextResponse = {
      kind: 'value',
      value: { ...validAnalysis, requiredDocuments: ['a'.repeat(201)] },
    };

    const response = await postAnalyze(purchase.id, token, { problem: validProblem });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('resposta da IA inválida (schema incompatível) → 503 AI_INVALID_RESPONSE', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    nextResponse = { kind: 'value', value: { summary: 'só o resumo' } };

    const response = await postAnalyze(purchase.id, token, { problem: validProblem });

    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: { message: 'Something went wrong', code: 'INTERNAL_ERROR' },
    });
  });

  it('resposta da IA com possibleCauses vazio → 503 AI_INVALID_RESPONSE', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    nextResponse = {
      kind: 'value',
      value: { ...validAnalysis, possibleCauses: [] },
    };

    const response = await postAnalyze(purchase.id, token, { problem: validProblem });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('provider indisponível (request error) → 503', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const { AIProviderRequestError } = await import('../src/services/ai/ai.provider.js');
    nextResponse = { kind: 'throw', error: new AIProviderRequestError() };

    const response = await postAnalyze(purchase.id, token, { problem: validProblem });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('provider não configurado → 503 sem expor detalhes internos', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const { AIProviderNotConfiguredError } = await import('../src/services/ai/ai.provider.js');
    nextResponse = { kind: 'throw', error: new AIProviderNotConfiguredError() };

    const response = await postAnalyze(purchase.id, token, { problem: validProblem });

    expect(response.status).toBe(503);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(response.body).not.toHaveProperty('stack');
    expect(JSON.stringify(response.body)).not.toContain('GEMINI');
  });

  it('envia à IA somente os campos esperados e o problema já normalizado (trim)', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id, {
      productName: 'Máquina de lavar',
      brand: 'Brastemp',
      model: 'BWF11',
      store: 'Magazine',
      purchaseDate: new Date('2026-09-10T00:00:00.000Z'),
    });
    await createWarranty(purchase.id, daysFromToday(-5), daysFromToday(5));

    const response = await postAnalyze(purchase.id, token, {
      problem: '   A máquina não centrifuga.   ',
    });

    expect(response.status).toBe(200);
    expect(Object.keys(capturedInput ?? {}).sort()).toEqual(
      [
        'brand',
        'model',
        'problem',
        'productName',
        'purchaseDate',
        'store',
        'warrantyEndDate',
        'warrantyStartDate',
        'warrantyStatus',
      ].sort(),
    );
    expect(capturedInput?.problem).toBe('A máquina não centrifuga.');
    expect(capturedInput?.productName).toBe('Máquina de lavar');
    expect(capturedInput?.purchaseDate).toBe('2026-09-10');
  });

  it('não persiste nada (stateless)', async () => {
    const { user, token } = await createUserWithToken();
    const purchase = await createPurchase(user.id);

    const before = {
      purchases: await testPrisma.purchase.count(),
      warranties: await testPrisma.warranty.count(),
    };

    const response = await postAnalyze(purchase.id, token, { problem: validProblem });
    expect(response.status).toBe(200);

    expect(await testPrisma.purchase.count()).toBe(before.purchases);
    expect(await testPrisma.warranty.count()).toBe(before.warranties);
  });
});
