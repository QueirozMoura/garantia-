// Rate limiting behaviour for auth and AI endpoints.
//
// Cada arquivo de teste roda no seu próprio processo (vitest `pool: 'forks'`),
// então definir os limites aqui afeta somente este arquivo. Os valores são
// lidos por src/config/env.ts no primeiro import; setamos ANTES de importar o app.
process.env.RATE_LIMIT_AUTH_MAX = '3';
process.env.RATE_LIMIT_AI_MAX = '3';

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { cleanDatabase, disconnectDatabase, testPrisma } from './helpers/db.js';

const LIMIT = 3;

const RATE_LIMIT_BODY = {
  error: {
    code: 'RATE_LIMIT_EXCEEDED',
    message: 'Muitas tentativas. Tente novamente mais tarde.',
  },
} as const;

type ApiClient = ReturnType<typeof import('./helpers/http.js').api>;

let api: () => ApiClient;
let createUserWithToken: typeof import('./helpers/http.js').createUserWithToken;

const validProblem = 'A máquina de lavar não está centrifugando.';

const validAnalysis = {
  summary: 'Resumo do problema.',
  possibleCauses: ['Causa possível A.', 'Causa possível B.'],
  recommendedAction: 'Procure assistência técnica autorizada.',
  safetyNote: 'Evite desmontar o equipamento.',
  warrantyGuidance: 'Consulte os canais autorizados.',
  requiredDocuments: ['Nota fiscal ou comprovante de compra'],
};

const validMessage = {
  message:
    'Olá, gostaria de solicitar assistência técnica para o meu produto. ' +
    'Poderiam me orientar sobre como proceder?',
};

const createPurchase = async (userId: string) =>
  testPrisma.purchase.create({
    data: {
      userId,
      productName: 'Produto',
      brand: 'Marca',
      model: 'Modelo',
      store: 'Loja',
      serialNumber: 'SN-0001',
      purchaseDate: new Date('2026-09-10T00:00:00.000Z'),
      price: '100.00',
      category: 'Eletrônicos',
    },
  });

const createDocument = async (purchaseId: string) =>
  testPrisma.document.create({
    data: {
      purchaseId,
      name: 'Nota fiscal',
      fileName: 'nota.pdf',
      mimeType: 'application/pdf',
      size: 1024,
      storagePath: `${crypto.randomUUID()}.pdf`,
      type: 'INVOICE',
    },
  });

// Conta chamadas ao provider de IA — usado para provar que um 429 NÃO chega ao provider.
let providerCalls = 0;

const postLogin = () =>
  api().post('/auth/login').send({ email: 'user@example.test', password: 'senha-invalida' });

const postRegister = () =>
  api()
    .post('/auth/register')
    .send({
      name: 'User',
      email: `user-${crypto.randomUUID()}@example.test`,
      password: 'senha12345',
    });

const postAnalyze = (purchaseId: string, token: string) =>
  api()
    .post(`/purchases/${purchaseId}/assistance/analyze`)
    .set('Authorization', `Bearer ${token}`)
    .send({ problem: validProblem });

const postMessage = (purchaseId: string, token: string) =>
  api()
    .post(`/purchases/${purchaseId}/assistance/message`)
    .set('Authorization', `Bearer ${token}`)
    .send({ problem: validProblem });

const postExtract = (documentId: string, token: string) =>
  api().post(`/documents/${documentId}/extract`).set('Authorization', `Bearer ${token}`).send();

describe('rate limiting', () => {
  beforeAll(async () => {
    await cleanDatabase();

    // Mock apenas `getAIProvider`; o service/validação reais continuam rodando.
    vi.resetModules();
    vi.doMock('../src/services/ai/ai.service.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/services/ai/ai.service.js')>();
      return {
        ...actual,
        getAIProvider: () => ({
          extractPurchaseData: async () => {
            providerCalls += 1;
            return {
              productName: 'Produto',
              brand: null,
              model: null,
              purchaseDate: null,
              price: null,
              store: null,
              invoiceNumber: null,
              warrantyMonths: null,
            };
          },
          analyzeAssistance: async () => {
            providerCalls += 1;
            return validAnalysis;
          },
          generateAssistanceMessage: async () => {
            providerCalls += 1;
            return validMessage;
          },
        }),
      };
    });

    const { app } = await import('../src/app.js');
    const request = (await import('supertest')).default;
    api = () => request(app);
    const httpHelpers = await import('./helpers/http.js');
    createUserWithToken = httpHelpers.createUserWithToken;
  });

  afterAll(async () => {
    await cleanDatabase();
    await disconnectDatabase();
    vi.doUnmock('../src/services/ai/ai.service.js');
    vi.resetModules();
  });

  // -------------------------------------------------------------------------
  // AUTH — limiter por IP (mesmo IP em toda a suíte).
  //
  // O contador é compartilhado por IP, portanto os testes de login consomem o
  // MESMO contador. A ordem abaixo é intencional e determinística:
  //   1) 1ª requisição abaixo do limite → passa (401);
  //   2) esgotar o restante e provar 429 nas seguintes.
  // O register tem seu próprio contador (o limiter é compartilhado, mas o
  // express-rate-limit conta por store+chave; usamos rotas diferentes).
  // -------------------------------------------------------------------------
  describe('POST /auth/login (por IP)', () => {
    it('abaixo do limite continua respondendo com 401 (não 429)', async () => {
      const response = await postLogin();

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('acima do limite retorna 429 RATE_LIMIT_EXCEEDED', async () => {
      let last;
      // A primeira tentativa já foi feita no teste anterior (LIMIT = 3).
      for (let attempt = 0; attempt < LIMIT; attempt += 1) {
        last = await postLogin();
      }

      expect(last?.status).toBe(429);
      expect(last?.body).toEqual(RATE_LIMIT_BODY);
    });

    it('permanece 429 e não vaza detalhes internos', async () => {
      const response = await postLogin();

      expect(response.status).toBe(429);
      expect(response.body).not.toHaveProperty('stack');
      expect(JSON.stringify(response.body)).not.toContain('at ');
    });
  });

  describe('POST /auth/register (por IP)', () => {
    it('abaixo do limite continua respondendo', async () => {
      const response = await postRegister();

      // Cadastro válido → 201; prova que o limiter deixou passar.
      expect(response.status).toBe(201);
    });

    it('acima do limite retorna 429 RATE_LIMIT_EXCEEDED', async () => {
      let last;
      for (let attempt = 0; attempt < LIMIT; attempt += 1) {
        last = await postRegister();
      }

      expect(last?.status).toBe(429);
      expect(last?.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    });
  });
  // -------------------------------------------------------------------------
  // IA — limiter por usuário autenticado (instância por endpoint)
  // -------------------------------------------------------------------------
  describe('POST /documents/:documentId/extract (por usuário)', () => {
    it('abaixo do limite passa pelo limiter (não 429)', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);
      const document = await createDocument(purchase.id);

      const response = await postExtract(document.id, token);

      expect(response.status).not.toBe(429);
    });

    it('acima do limite retorna 429 sem chamar o provider de IA', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);
      const document = await createDocument(purchase.id);

      // Esgota o limite (LIMIT) e mede as chamadas ao provider antes/depois.
      for (let attempt = 0; attempt < LIMIT; attempt += 1) {
        await postExtract(document.id, token);
      }

      const callsBefore = providerCalls;
      const response = await postExtract(document.id, token);

      expect(response.status).toBe(429);
      expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      // O 429 é barrado ANTES do controller: o provider não é chamado.
      expect(providerCalls).toBe(callsBefore);
    });
  });

  describe('POST /purchases/:purchaseId/assistance/analyze (por usuário)', () => {
    it('abaixo do limite continua funcionando (200)', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);

      const response = await postAnalyze(purchase.id, token);

      expect(response.status).toBe(200);
      expect(response.body.analysis).toEqual(validAnalysis);
    });

    it('acima do limite retorna 429 sem chamar o provider de IA', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);

      for (let attempt = 0; attempt < LIMIT; attempt += 1) {
        await postAnalyze(purchase.id, token);
      }

      const callsBefore = providerCalls;
      const response = await postAnalyze(purchase.id, token);

      expect(response.status).toBe(429);
      expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(providerCalls).toBe(callsBefore);
    });
  });

  describe('POST /purchases/:purchaseId/assistance/message (por usuário)', () => {
    it('abaixo do limite continua funcionando (200)', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);

      const response = await postMessage(purchase.id, token);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: validMessage.message });
    });

    it('acima do limite retorna 429 sem chamar o provider de IA', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);

      for (let attempt = 0; attempt < LIMIT; attempt += 1) {
        await postMessage(purchase.id, token);
      }

      const callsBefore = providerCalls;
      const response = await postMessage(purchase.id, token);

      expect(response.status).toBe(429);
      expect(response.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(providerCalls).toBe(callsBefore);
    });
  });

  describe('isolamento e regressão', () => {
    it('usuários autenticados diferentes têm contadores independentes', async () => {
      const first = await createUserWithToken();
      const second = await createUserWithToken();
      const purchaseFirst = await createPurchase(first.user.id);
      const purchaseSecond = await createPurchase(second.user.id);

      // Esgota o limite do primeiro usuário.
      for (let attempt = 0; attempt < LIMIT + 1; attempt += 1) {
        await postMessage(purchaseFirst.id, first.token);
      }

      // O primeiro está bloqueado; o segundo (usuário distinto) segue liberado.
      const blocked = await postMessage(purchaseFirst.id, first.token);
      expect(blocked.status).toBe(429);

      const allowed = await postMessage(purchaseSecond.id, second.token);
      expect(allowed.status).toBe(200);
    });

    it('endpoint de IA sem autenticação continua retornando 401 (não 429)', async () => {
      const { user } = await createUserWithToken();
      const purchase = await createPurchase(user.id);

      const response = await api()
        .post(`/purchases/${purchase.id}/assistance/analyze`)
        .send({ problem: validProblem });

      expect(response.status).toBe(401);
      expect(response.body.error.code).toBe('AUTH_REQUIRED');
    });

    it('o rate limit não libera acesso a recurso de outro usuário (403 preservado)', async () => {
      const owner = await createUserWithToken();
      const attacker = await createUserWithToken();
      const purchase = await createPurchase(owner.user.id);

      // O atacante (dentro do seu próprio orçamento) tenta a compra do dono.
      const response = await postMessage(purchase.id, attacker.token);

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('PURCHASE_ACCESS_DENIED');
    });

    it('o 429 não executa operação de banco depois do middleware', async () => {
      const { user, token } = await createUserWithToken();
      const purchase = await createPurchase(user.id);

      for (let attempt = 0; attempt < LIMIT; attempt += 1) {
        await postMessage(purchase.id, token);
      }

      // Já bloqueado: usa um purchaseId válido, mas o limiter barra antes do
      // controller/service, então nada é lido/escrito no banco.
      const before = await testPrisma.purchase.count();
      await postMessage(purchase.id, token);
      const after = await testPrisma.purchase.count();

      expect(after).toBe(before);
    });
  });
});
