// Testes unitários do NvidiaProvider (extração de nota fiscal em imagem).
//
// Nenhuma chamada real é feita à NVIDIA: `fetch` global é mockado, então o que
// se prova aqui é o comportamento do NOSSO provider — montagem do payload
// (`image_url` com data URI), parsing da resposta OpenAI-compatible e tradução
// de erros para o contrato de IA compartilhado — inclusive a ausência de
// vazamento de detalhes internos/chave.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// env mockado: o provider lê apenas `nvidiaApiKey`.
vi.mock('../src/config/env.js', () => ({
  env: { nvidiaApiKey: 'test-nvidia-key' },
}));

const { env } = await import('../src/config/env.js');
const {
  AIProviderNotConfiguredError,
  AIProviderRequestError,
  AIProviderInvalidResponseError,
  AIProviderUnsupportedFormatError,
} = await import('../src/services/ai/ai.provider.js');
const { NvidiaProvider } = await import('../src/services/ai/nvidia.provider.js');

const envMutavel = env as { nvidiaApiKey: string | undefined };

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

// Resposta OpenAI-compatible mínima, com o conteúdo como string JSON.
const successResponse = (content: string) => {
  const message = { content: content };
  const choice = { message: message };
  const body = { choices: [choice] };
  return { ok: true, status: 200, json: async () => body };
};

const pngDocument = {
  content: Buffer.from('fake-png-bytes'),
  mimeType: 'image/png' as const,
  fileName: 'nota.png',
};

const jpegDocument = {
  content: Buffer.from('fake-jpeg-bytes'),
  mimeType: 'image/jpeg' as const,
  fileName: 'nota.jpg',
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  envMutavel.nvidiaApiKey = 'test-nvidia-key';
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('NvidiaProvider.extractPurchaseData', () => {
  it('imagem PNG válida → envia image_url com data URI e retorna o JSON extraído', async () => {
    fetchMock.mockResolvedValue(successResponse(JSON.stringify(validExtraction)));

    const provider = new NvidiaProvider();
    const result = await provider.extractPurchaseData(pngDocument);

    expect(result).toEqual(validExtraction);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect(init.method).toBe('POST');

    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer test-nvidia-key');

    const body = JSON.parse(init.body as string);
    expect(body.model).toBe('nvidia/nemotron-3-nano-omni-30b-a3b-reasoning');

    const content = body.messages[0].content;
    const imagePart = content.find((part: { type: string }) => part.type === 'image_url');
    expect(imagePart.image_url.url).toBe(
      `data:image/png;base64,${pngDocument.content.toString('base64')}`,
    );
  });

  it('imagem JPEG válida → usa o data URI de image/jpeg', async () => {
    fetchMock.mockResolvedValue(successResponse(JSON.stringify(validExtraction)));

    const provider = new NvidiaProvider();
    const result = await provider.extractPurchaseData(jpegDocument);

    expect(result).toEqual(validExtraction);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(init.body as string);
    const imagePart = body.messages[0].content.find(
      (part: { type: string }) => part.type === 'image_url',
    );
    expect(imagePart.image_url.url).toBe(
      `data:image/jpeg;base64,${jpegDocument.content.toString('base64')}`,
    );
  });

  it('PDF é rejeitado como formato não suportado, sem chamar a NVIDIA', async () => {
    const provider = new NvidiaProvider();

    await expect(
      provider.extractPurchaseData({
        content: Buffer.from('%PDF-1.4'),
        mimeType: 'application/pdf' as never,
        fileName: 'nota.pdf',
      }),
    ).rejects.toBeInstanceOf(AIProviderUnsupportedFormatError);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('erro HTTP da NVIDIA não vaza detalhes internos nem a API key', async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({
        error: { message: 'internal nvidia error', apiKey: 'test-nvidia-key' },
      }),
    });

    const provider = new NvidiaProvider();

    try {
      await provider.extractPurchaseData(pngDocument);
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(AIProviderRequestError);
      const serialized = JSON.stringify(error, Object.getOwnPropertyNames(error));
      expect(serialized).not.toContain('test-nvidia-key');
      expect(serialized).not.toContain('internal nvidia error');
      expect((error as Error).message).toBe('AI provider request failed');
    }
  });

  it('resposta sem choices/content é tratada como resposta inválida', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ choices: [] }),
    });

    const provider = new NvidiaProvider();

    await expect(provider.extractPurchaseData(pngDocument)).rejects.toBeInstanceOf(
      AIProviderInvalidResponseError,
    );
  });

  it('sem NVIDIA_API_KEY → AIProviderNotConfiguredError', () => {
    envMutavel.nvidiaApiKey = undefined;

    expect(() => new NvidiaProvider()).toThrow(AIProviderNotConfiguredError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('NvidiaProvider — métodos de assistência não implementados neste passo', () => {
  it('analyzeAssistance/generateAssistanceMessage são não suportados e não chamam a NVIDIA', async () => {
    const provider = new NvidiaProvider();

    await expect(
      provider.analyzeAssistance({} as never),
    ).rejects.toBeInstanceOf(AIProviderUnsupportedFormatError);
    await expect(
      provider.generateAssistanceMessage({} as never),
    ).rejects.toBeInstanceOf(AIProviderUnsupportedFormatError);

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
