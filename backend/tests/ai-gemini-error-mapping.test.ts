// Testes do tratamento de erros da integração de IA (Gemini) na extração.
//
// Objetivo: garantir que um erro `INVALID_ARGUMENT` (HTTP 400) do Gemini,
// relacionado ao conteúdo/formato do documento enviado, seja traduzido para um
// erro público estável e apropriado (`AI_FORMAT_UNSUPPORTED`, HTTP 400) em vez
// de ser mascarado como `INTERNAL_ERROR` (HTTP 503).
//
// Nenhuma chamada real é feita ao Gemini: o SDK `@google/genai` e o `env` são
// mockados, então o que se prova aqui é o comportamento do NOSSO provider e do
// mapeamento de erro público — inclusive a ausência de vazamento de detalhes
// internos da API do provider.
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A resposta que o client falso do Gemini devolve (ou o erro que ele lança).
type GenerateContentResult = { kind: 'value'; value: unknown } | { kind: 'throw'; error: Error };

let nextResult: GenerateContentResult;

// `generateContent` do client falso: captura a chamada e devolve/erra conforme
// o teste definiu. Nenhuma chamada de rede acontece.
const generateContent = vi.fn(async () => {
  if (nextResult.kind === 'throw') throw nextResult.error;
  return nextResult.value;
});

// Forma mínima do `ApiError` do SDK, replicando `status` + `instanceof`.
class FakeApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    Object.setPrototypeOf(this, FakeApiError.prototype);
  }
}

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
  ApiError: FakeApiError,
}));

vi.mock('../src/config/env.js', () => ({
  env: { geminiApiKey: 'test-api-key' },
}));

const { AIProviderUnsupportedFormatError, AIProviderRequestError, AIProviderInvalidResponseError } =
  await import('../src/services/ai/ai.provider.js');
const { GeminiProvider } = await import('../src/services/ai/gemini.provider.js');
const { publicAIError } = await import('../src/services/ai/ai.service.js');

const validExtraction = {
  productName: 'Notebook',
  brand: 'Dell',
  model: 'XPS 15',
  purchaseDate: '2025-09-06',
  price: 3499.9,
  store: null,
  invoiceNumber: null,
  warrantyMonths: null,
};

const documentInput = {
  content: Buffer.from('%PDF-1.4\n%%EOF'),
  mimeType: 'application/pdf' as const,
  fileName: 'nota.pdf',
};

beforeEach(() => {
  generateContent.mockClear();
  nextResult = { kind: 'value', value: { text: JSON.stringify(validExtraction) } };
});

describe('GeminiProvider — tratamento de erro de conteúdo/formato', () => {
  it('INVALID_ARGUMENT (ApiError 400) vira AIProviderUnsupportedFormatError', async () => {
    nextResult = {
      kind: 'throw',
      error: new FakeApiError(
        '{"error":{"code":400,"message":"Request contains an invalid argument.","status":"INVALID_ARGUMENT"}}',
        400,
      ),
    };

    const provider = new GeminiProvider();

    await expect(provider.extractPurchaseData(documentInput)).rejects.toBeInstanceOf(
      AIProviderUnsupportedFormatError,
    );
  });

  it('o erro de formato NÃO expõe detalhes internos do Gemini', async () => {
    nextResult = {
      kind: 'throw',
      error: new FakeApiError(
        '{"error":{"code":400,"message":"Request contains an invalid argument.","status":"INVALID_ARGUMENT","apiKey":"SECRET-GEMINI-KEY"}}',
        400,
      ),
    };

    const provider = new GeminiProvider();

    try {
      await provider.extractPurchaseData(documentInput);
      throw new Error('should have thrown');
    } catch (error) {
      const serialized = JSON.stringify(error, Object.getOwnPropertyNames(error));
      expect(serialized).not.toContain('INVALID_ARGUMENT');
      expect(serialized).not.toContain('SECRET-GEMINI-KEY');
      expect(serialized).not.toContain('apiKey');
      expect((error as Error).message).toBe('AI provider does not support application/pdf');
    }
  });

  it('outros erros do SDK (ex.: 500) continuam como AIProviderRequestError', async () => {
    nextResult = {
      kind: 'throw',
      error: new FakeApiError('{"error":{"code":500,"status":"INTERNAL"}}', 500),
    };

    const provider = new GeminiProvider();

    await expect(provider.extractPurchaseData(documentInput)).rejects.toBeInstanceOf(
      AIProviderRequestError,
    );
  });

  it('documento válido continua funcionando normalmente (200 → dados extraídos)', async () => {
    const provider = new GeminiProvider();

    const result = await provider.extractPurchaseData(documentInput);

    expect(result).toEqual(validExtraction);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it('resposta sem texto continua como AIProviderInvalidResponseError', async () => {
    nextResult = { kind: 'value', value: {} };

    const provider = new GeminiProvider();

    await expect(provider.extractPurchaseData(documentInput)).rejects.toBeInstanceOf(
      AIProviderInvalidResponseError,
    );
  });
});

describe('publicAIError — mapeamento do erro público', () => {
  it('AIProviderUnsupportedFormatError vira 400 AI_FORMAT_UNSUPPORTED', () => {
    const publicError = publicAIError(new AIProviderUnsupportedFormatError('application/pdf'));

    expect(publicError).not.toBeNull();
    expect(publicError?.statusCode).toBe(400);
    expect(publicError?.code).toBe('AI_FORMAT_UNSUPPORTED');
    // Mensagem pública estável, sem detalhes internos do provider.
    expect(publicError?.message).not.toContain('INVALID_ARGUMENT');
  });

  it('o código público de formato chega ao error-handler como 400 (não INTERNAL_ERROR)', () => {
    const publicError = publicAIError(new AIProviderUnsupportedFormatError('application/pdf'));

    // Reproduz a decisão do error-handler: status < 500 preserva `code`/`message`.
    const status = publicError?.statusCode ?? 500;
    const isServerError = status >= 500;
    const body = {
      error: {
        message: isServerError ? 'Something went wrong' : publicError?.message,
        code: isServerError ? 'INTERNAL_ERROR' : publicError?.code,
      },
    };

    expect(body).toEqual({
      error: {
        message: 'This document format is not supported by the AI provider',
        code: 'AI_FORMAT_UNSUPPORTED',
      },
    });
  });

  it('erros conhecidos de IA já existentes preservam seu mapeamento atual', () => {
    // AIProviderRequestError e AIProviderInvalidResponseError continuam 503.
    expect(publicAIError(new AIProviderRequestError())?.statusCode).toBe(503);
    expect(publicAIError(new AIProviderInvalidResponseError())?.statusCode).toBe(503);

    // Um erro desconhecido não é traduzido (segue o handler padrão).
    expect(publicAIError(new Error('boom'))).toBeNull();
  });
});
