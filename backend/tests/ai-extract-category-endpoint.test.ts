// Teste de integração: a categoria sugerida pela IA chega ao cliente HTTP.
//
// Prova, através da pilha HTTP real (Express + controller + error-handler), que:
//  - uma categoria VÁLIDA devolvida pelo provider chega em `data.category`;
//  - uma categoria INVÁLIDA devolvida pelo provider chega como `data.category:
//    null` (normalizada pelo ponto central `extractPurchaseData`);
//  - uma resposta sem `category` devolve `data.category: null`;
//  - os demais campos da extração continuam intactos.
//
// O `getAIProvider` é mockado (não se chama a IA real). O restante do pipeline —
// controller, `extractPurchaseData`, schema/normalização, publicAIError e
// error-handler — roda de verdade. Não altera nenhum comportamento de produção.
import { randomUUID } from 'node:crypto';
import { rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { cleanDatabase, disconnectDatabase, testPrisma } from './helpers/db.js';

type ApiClient = ReturnType<typeof import('./helpers/http.js').api>;

let api: () => ApiClient;
let createUserWithToken: typeof import('./helpers/http.js').createUserWithToken;

// O service lê o arquivo real em `backend/uploads` (path.resolve do cwd). Esta
// suíte grava um PDF mínimo por documento criado e remove APENAS esses arquivos
// no final, nunca tocando uploads pré-existentes.
const uploadsDirectory = path.resolve(process.cwd(), 'uploads');
const createdStoragePaths = new Set<string>();

const createInvoiceWithFile = async (userId: string) => {
  const purchase = await testPrisma.purchase.create({
    data: {
      userId,
      productName: 'Produto endpoint',
      purchaseDate: new Date('2024-01-01T00:00:00.000Z'),
      price: '100.00',
      category: 'electronics',
    },
  });

  const storagePath = `${randomUUID()}.pdf`;
  // Conteúdo mínimo com assinatura de PDF válida; os bytes concretos não
  // importam aqui porque o provider de IA é mockado.
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

// Resposta devolvida pelo provider mockado na extração, controlada por teste.
let nextExtractValue: unknown = {};

const baseExtraction = () => ({
  productName: 'Notebook Dell XPS 15',
  brand: 'Dell',
  model: 'XPS 15 9530',
  purchaseDate: '2024-05-10',
  price: 8749.9,
  store: 'Magazine Luiza',
  invoiceNumber: '12345',
  warrantyMonths: 12,
});

describe('POST /documents/:documentId/extract — categoria sugerida pela IA', () => {
  beforeAll(async () => {
    await cleanDatabase();

    vi.resetModules();
    vi.doMock('../src/services/ai/ai.service.js', async (importOriginal) => {
      const actual = await importOriginal<typeof import('../src/services/ai/ai.service.js')>();
      return {
        ...actual,
        getAIProvider: () => ({
          extractPurchaseData: async () => nextExtractValue,
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
    nextExtractValue = {};
  });

  afterAll(async () => {
    await cleanDatabase();
    for (const storagePath of createdStoragePaths) {
      await rm(path.resolve(uploadsDirectory, storagePath), { force: true }).catch(() => undefined);
    }
    await disconnectDatabase();
  });

  const extractFor = async () => {
    const { user, token } = await createUserWithToken();
    const { document } = await createInvoiceWithFile(user.id);

    return api()
      .post(`/documents/${document.id}/extract`)
      .set('Authorization', `Bearer ${token}`)
      .send();
  };

  it('devolve category no JSON quando a IA retorna uma categoria válida', async () => {
    nextExtractValue = { ...baseExtraction(), category: 'Informática' };

    const response = await extractFor();

    expect(response.status).toBe(200);
    expect(response.body.data.category).toBe('Informática');
    // Demais campos intactos.
    expect(response.body.data).toMatchObject(baseExtraction());
  });

  it('devolve category null quando a IA retorna uma categoria inválida', async () => {
    nextExtractValue = { ...baseExtraction(), category: 'Geladeira' };

    const response = await extractFor();

    expect(response.status).toBe(200);
    expect(response.body.data.category).toBeNull();
    // A categoria inválida NÃO é convertida em outra válida.
    expect(response.body.data).toMatchObject({ ...baseExtraction(), category: null });
  });

  it('devolve category null quando a IA não identifica categoria (campo ausente)', async () => {
    nextExtractValue = baseExtraction();

    const response = await extractFor();

    expect(response.status).toBe(200);
    expect(response.body.data.category).toBeNull();
    expect(response.body.data).toMatchObject(baseExtraction());
  });

  it('devolve category null quando a IA retorna categoria vazia', async () => {
    nextExtractValue = { ...baseExtraction(), category: '   ' };

    const response = await extractFor();

    expect(response.status).toBe(200);
    expect(response.body.data.category).toBeNull();
  });
});
