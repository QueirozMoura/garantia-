// Testes unitários do NvidiaProvider (extração de nota fiscal em imagem e PDF).
//
// Nenhuma chamada real é feita à NVIDIA: `fetch` global é mockado, então o que
// se prova aqui é o comportamento do NOSSO provider — montagem do payload
// (`image_url` com data URI), conversão de PDF em páginas PNG, parsing da
// resposta OpenAI-compatible e tradução de erros para o contrato de IA
// compartilhado — inclusive a ausência de vazamento de detalhes internos/chave.
//
// A conversão de PDF é mockada para manter o teste determinístico: o conversor
// real (pdfjs + canvas) tem testes próprios em `pdf-to-images.test.ts`. O que se
// verifica aqui é COMO o provider usa o conversor e como monta o request.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// env mockado: o provider lê apenas `nvidiaApiKey`.
vi.mock('../src/config/env.js', () => ({
  env: { nvidiaApiKey: 'test-nvidia-key' },
}));

// Mock do utilitário existente de conversão: controlamos quantas páginas (PNG)
// ele devolve e com que bytes, sem renderizar PDF de verdade. O limite de
// páginas continua sendo responsabilidade do conversor (testado no arquivo
// dele), então aqui simulamos o erro que ele lançaria.
vi.mock('../src/services/ai/pdf-to-images.js', async () => {
  const actual = await vi.importActual<typeof import('../src/services/ai/pdf-to-images.js')>(
    '../src/services/ai/pdf-to-images.js',
  );
  return { ...actual, convertPdfToPngImages: vi.fn() };
});

const { env } = await import('../src/config/env.js');
const {
  AIProviderNotConfiguredError,
  AIProviderRequestError,
  AIProviderInvalidResponseError,
  AIProviderUnsupportedFormatError,
} = await import('../src/services/ai/ai.provider.js');
const { NvidiaProvider } = await import('../src/services/ai/nvidia.provider.js');
const { convertPdfToPngImages, PdfConversionTooManyPagesError, MAX_PDF_PAGES } = await import(
  '../src/services/ai/pdf-to-images.js'
);

const convertPdfMock = convertPdfToPngImages as unknown as ReturnType<typeof vi.fn>;

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

const pdfDocument = (content = Buffer.from('%PDF-1.4 fake')) => ({
  content,
  mimeType: 'application/pdf' as const,
  fileName: 'nota.pdf',
});

// Bytes distintos por página: permite provar que a ORDEM das páginas é mantida
// na montagem do payload.
const pdfPages = (pageCount: number): Buffer[] =>
  Array.from({ length: pageCount }, (_, index) => Buffer.from(`png-page-${index + 1}`));

// Data URIs das partes `image_url` enviadas ao modelo, na ordem em que aparecem.
const imageUrlsFrom = (init: RequestInit): string[] => {
  const body = JSON.parse(init.body as string);
  return body.messages[0].content
    .filter((part: { type: string }) => part.type === 'image_url')
    .map((part: { image_url: { url: string } }) => part.image_url.url);
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  envMutavel.nvidiaApiKey = 'test-nvidia-key';
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  convertPdfMock.mockReset();
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

  it('PDF de 1 página → convertido para PNG e enviado como uma única imagem', async () => {
    fetchMock.mockResolvedValue(successResponse(JSON.stringify(validExtraction)));
    convertPdfMock.mockResolvedValue(pdfPages(1));

    const provider = new NvidiaProvider();
    const result = await provider.extractPurchaseData(pdfDocument(Buffer.from('%PDF-1.4 one')));

    expect(result).toEqual(validExtraction);
    expect(convertPdfMock).toHaveBeenCalledTimes(1);

    const urls = imageUrlsFrom(fetchMock.mock.calls[0][1] as RequestInit);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toBe('data:image/png;base64,cG5nLXBhZ2UtMQ==');
  });

  it('PDF de múltiplas páginas → envia todas as páginas, como PNG, na ordem original', async () => {
    fetchMock.mockResolvedValue(successResponse(JSON.stringify(validExtraction)));
    convertPdfMock.mockResolvedValue(pdfPages(3));

    const provider = new NvidiaProvider();
    await provider.extractPurchaseData(pdfDocument());

    expect(fetchMock).toHaveBeenCalledTimes(1);

    const urls = imageUrlsFrom(fetchMock.mock.calls[0][1] as RequestInit);
    expect(urls).toHaveLength(3);
    expect(urls).toEqual(
      pdfPages(3).map((page) => `data:image/png;base64,${page.toString('base64')}`),
    );
  });

  it(`PDF acima de ${MAX_PDF_PAGES} páginas → erro do conversor sobe e a NVIDIA não é chamada`, async () => {
    convertPdfMock.mockRejectedValue(new PdfConversionTooManyPagesError(MAX_PDF_PAGES + 1, MAX_PDF_PAGES));

    const provider = new NvidiaProvider();

    await expect(provider.extractPurchaseData(pdfDocument())).rejects.toBeInstanceOf(
      PdfConversionTooManyPagesError,
    );

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('formato não suportado continua rejeitado, sem chamar o conversor nem a NVIDIA', async () => {
    const provider = new NvidiaProvider();

    await expect(
      provider.extractPurchaseData({
        content: Buffer.from('gif-bytes'),
        mimeType: 'image/gif' as never,
        fileName: 'nota.gif',
      }),
    ).rejects.toBeInstanceOf(AIProviderUnsupportedFormatError);

    expect(convertPdfMock).not.toHaveBeenCalled();
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
