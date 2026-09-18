// Teste de integração: o código público de erro de IA chega ao cliente.
//
// Prova, através da pilha HTTP real (Express + error-handler), que:
//  - um erro de formato de documento não suportado pela IA é respondido como
//    400 AI_FORMAT_UNSUPPORTED (código público estável), e NÃO como
//    503 INTERNAL_ERROR;
//  - a resposta não vaza stack trace nem detalhes internos do provider;
//  - o fluxo de extração de documento válido continua respondendo 200.
//
// O `getAIProvider` é mockado (não se chama o Gemini real); o restante do
// pipeline — controller, publicAIError, error-handler — roda de verdade.
import { randomUUID } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { cleanDatabase, disconnectDatabase, testPrisma } from './helpers/db.js';

type ApiClient = ReturnType<typeof import('./helpers/http.js').api>;

let api: () => ApiClient;
let createUserWithToken: typeof import('./helpers/http.js').createUserWithToken;

// The service reads the real file under `backend/uploads` (path.resolve of cwd).
// This suite writes a minimal valid PDF for each document it creates and removes
// exactly those files afterwards, never touching pre-existing uploads.
const uploadsDirectory = path.resolve(process.cwd(), 'uploads');
const createdStoragePaths = new Set<string>();

const createInvoiceWithFile = async (userId: string) => {
  const purchase = await testPrisma.purchase.create({
    data: {
      userId,
      productName: 'Produto',
      purchaseDate: new Date('2024-01-01T00:00:00.000Z'),
      price: '100.00',
      category: 'electronics',
    },
  });

  const storagePath = `${randomUUID()}.pdf`;
  // Minimal content with a valid PDF signature; the concrete bytes do not matter
  // here because the AI provider is mocked.
  await writeFile(path.resolve(uploadsDirectory, storagePath), '%PDF-1.4\n%%EOF');
  createdStoragePaths.add(storagePath);

  const document = await testPrisma.document.create({
    data: {
      purchaseId: purchase.id,
      name: 'invoice.pdf',
      fileName: 'invoice.pdf',
      mimeType: 'application/pdf',
      size: 14,
      storagePath,
      type: 'INVOICE',
    },
  });

  return { purchase, document };
};

// Erro que o provider mockado lança na extração, controlado por teste.
type ExtractResult = { kind: 'throw'; error: Error } | { kind: 'value'; value: unknown };
let nextExtract: ExtractResult = { kind: 'value', value: {} };

describe('POST /documents/:documentId/extract — erro de IA chega ao cliente', () => {
  beforeAll(async () => {
    await cleanDatabase();

    vi.resetModules();
    vi.doMock('../src/services/ai/ai.service.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/services/ai/ai.service.js')>();
      return {
        ...actual,
        getAIProvider: () => ({
          extractPurchaseData: async () => {
            if (nextExtract.kind === 'throw') throw nextExtract.error;
            return nextExtract.value;
          },
          analyzeAssistance: async () => ({}),
          generateAssistanceMessage: async () => ({}),
        }),
      };
    });

    const { app } = await import('../src/app.js');
    const request = (await import('supertest')).default;
    api = () => request(app);
    ({ createUserWithToken } = await import('./helpers/http.js'));
  });

  afterEach(() => {
    nextExtract = { kind: 'value', value: {} };
  });

  afterAll(async () => {
    await cleanDatabase();
    for (const storagePath of createdStoragePaths) {
      await rm(path.resolve(uploadsDirectory, storagePath), { force: true }).catch(() => undefined);
    }
    await disconnectDatabase();
  });

  it('formato/conteúdo não suportado → 400 AI_FORMAT_UNSUPPORTED (não INTERNAL_ERROR)', async () => {
    const { user, token } = await createUserWithToken();
    const { document } = await createInvoiceWithFile(user.id);

    const { AIProviderUnsupportedFormatError } = await import('../src/services/ai/ai.provider.js');
    nextExtract = { kind: 'throw', error: new AIProviderUnsupportedFormatError('application/pdf') };

    const response = await api()
      .post(`/documents/${document.id}/extract`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(response.status).toBe(400);
    expect(response.body).toEqual({
      error: {
        message: 'This document format is not supported by the AI provider',
        code: 'AI_FORMAT_UNSUPPORTED',
      },
    });
    // Não vaza detalhes internos nem stack.
    expect(response.body).not.toHaveProperty('stack');
    expect(JSON.stringify(response.body)).not.toContain('INVALID_ARGUMENT');
    expect(JSON.stringify(response.body)).not.toContain('GEMINI');
  });

  it('documento válido continua respondendo 200 normalmente', async () => {
    const { user, token } = await createUserWithToken();
    const { document } = await createInvoiceWithFile(user.id);

    nextExtract = {
      kind: 'value',
      value: {
        productName: 'Notebook',
        brand: null,
        model: null,
        purchaseDate: null,
        price: null,
        store: null,
        invoiceNumber: null,
        warrantyMonths: null,
      },
    };

    const response = await api()
      .post(`/documents/${document.id}/extract`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    expect(response.status).toBe(200);
    expect(response.body.data.productName).toBe('Notebook');
  });

  it('erro de requisição de IA já existente preserva o comportamento atual (503 mascarado)', async () => {
    const { user, token } = await createUserWithToken();
    const { document } = await createInvoiceWithFile(user.id);

    const { AIProviderRequestError } = await import('../src/services/ai/ai.provider.js');
    nextExtract = { kind: 'throw', error: new AIProviderRequestError() };

    const response = await api()
      .post(`/documents/${document.id}/extract`)
      .set('Authorization', `Bearer ${token}`)
      .send();

    // Contrato atual preservado: falhas de request de IA seguem 503/INTERNAL_ERROR.
    expect(response.status).toBe(503);
    expect(response.body).toEqual({
      error: { message: 'Something went wrong', code: 'INTERNAL_ERROR' },
    });
  });
});
