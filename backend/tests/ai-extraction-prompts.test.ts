// Testes dos prompts de extração por IA: eles devem solicitar `category`,
// listar apenas as categorias canônicas (PURCHASE_CATEGORIES) e permitir null.
//
// Nenhuma chamada real é feita à IA: o SDK do Gemini e o `fetch` global são
// mockados, capturando-se o TEXTO do prompt realmente enviado ao provider.
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PURCHASE_CATEGORIES } from '../src/modules/categories.js';

// Gemini: client falso que captura os argumentos de generateContent.
const generateContent = vi.fn(async () => ({ text: '{}' }));

vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent };
  },
  ApiError: class extends Error {},
}));

vi.mock('../src/config/env.js', () => ({
  env: {
    geminiApiKey: 'test-gemini-key',
    nvidiaApiKey: 'test-nvidia-key',
    aiProvider: 'http',
    aiApiUrl: 'https://ai.example.test/extract',
    aiApiKey: 'test-http-key',
  },
}));

// A conversão de PDF real (pdfjs/canvas) é mockada: o foco aqui é o prompt, não
// o pipeline de imagens (coberto em ai-nvidia-provider.test.ts).
vi.mock('../src/services/ai/pdf-to-images.js', () => ({
  convertPdfToPngImages: vi.fn(async () => [Buffer.from('png-page-1')]),
}));

const { GeminiProvider } = await import('../src/services/ai/gemini.provider.js');
const { NvidiaProvider } = await import('../src/services/ai/nvidia.provider.js');
const { getAIProvider } = await import('../src/services/ai/ai.service.js');

const documentInput = {
  content: Buffer.from('%PDF-1.4 fake'),
  mimeType: 'application/pdf' as const,
  fileName: 'nota.pdf',
};

/** Texto do prompt enviado ao Gemini, extraído da chamada a generateContent. */
const geminiPrompt = async (): Promise<string> => {
  const provider = new GeminiProvider();
  await provider.extractPurchaseData(documentInput);
  const call = generateContent.mock.calls[0] as unknown as [{ contents: { text: string }[] }];
  return call[0].contents[0].text;
};

/** Texto do prompt enviado ao NVIDIA (mocked fetch), a partir do request body. */
const nvidiaPrompt = async (): Promise<string> => {
  const provider = new NvidiaProvider();
  await provider.extractPurchaseData(documentInput);
  const init = fetchMock.mock.calls[0][1] as RequestInit;
  const body = JSON.parse(init.body as string);
  const textPart = body.messages[0].content.find((part: { type: string }) => part.type === 'text');
  return textPart.text;
};

/** Instrução do provider HTTP genérico, capturada do request body. */
const httpInstruction = async (): Promise<string> => {
  const provider = getAIProvider();
  await provider.extractPurchaseData(documentInput);
  const init = fetchMock.mock.calls[0][1] as RequestInit;
  return JSON.parse(init.body as string).instruction;
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  generateContent.mockClear();
  fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      // Provider HTTP genérico lê `data`; NVIDIA lê `choices[0].message.content`.
      data: {},
      choices: [{ message: { content: '{}' } }],
    }),
  }));
  vi.stubGlobal('fetch', fetchMock);
});

const prompts = [
  { name: 'Gemini', get: geminiPrompt },
  { name: 'NVIDIA', get: nvidiaPrompt },
  { name: 'HTTP (extractionInstruction)', get: httpInstruction },
] as const;

describe.each(prompts)('prompt de extração — $name', ({ get }) => {
  it('menciona o campo category a ser extraído', async () => {
    const prompt = await get();

    expect(prompt).toContain('category');
  });

  it('lista todas as categorias canônicas de PURCHASE_CATEGORIES', async () => {
    const prompt = await get();

    for (const category of PURCHASE_CATEGORIES) {
      expect(prompt).toContain(category);
    }
  });

  it('não inclui o rótulo de interface "Outra" como categoria permitida', async () => {
    const prompt = await get();

    expect(prompt).not.toMatch(/\bOutra\b/);
  });

  it('permite retornar null quando não houver evidência suficiente', async () => {
    const prompt = await get();

    expect(prompt.toLowerCase()).toContain('null');
  });

  it('instrui a não criar/inventar categorias fora da lista', async () => {
    const prompt = await get();

    // Instrução explícita de não inventar/combinar/traduzir categorias.
    expect(prompt.toLowerCase()).toMatch(/invent|create|combine|translate/);
  });

  it('preserva as instruções dos demais campos (purchaseDate, price)', async () => {
    const prompt = await get();

    expect(prompt).toContain('purchaseDate');
    expect(prompt).toContain('price');
  });
});
