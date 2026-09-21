// Testes da normalização da categoria retornada pela IA em `extractPurchaseData`.
//
// O ponto central (ai.service.ts) passa por todos os providers. Aqui usamos um
// provider FAKE (sem chamada real à IA) para provar que qualquer categoria fora
// de PURCHASE_CATEGORIES vira `null`, sem case-insensitive, sem correção de
// acentos e sem fuzzy matching, e que os demais campos ficam intactos.
import { describe, expect, it } from 'vitest';

import { isPurchaseCategory, PURCHASE_CATEGORIES } from '../src/modules/categories.js';
import type { AIProvider, AiDocumentInput } from '../src/services/ai/ai.provider.js';
import { extractPurchaseData } from '../src/services/ai/ai.service.js';

const document: AiDocumentInput = {
  content: Buffer.from('%PDF-1.4 fake'),
  mimeType: 'application/pdf',
  fileName: 'nota.pdf',
};

// Provider fake: devolve exatamente o objeto configurado, sem rede.
const providerReturning = (value: unknown): AIProvider => ({
  async extractPurchaseData() {
    return value;
  },
  async analyzeAssistance() {
    return {};
  },
  async generateAssistanceMessage() {
    return {};
  },
});

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

const extractWithCategory = async (category: unknown) =>
  extractPurchaseData(providerReturning({ ...baseExtraction(), category }), document);

describe('extractPurchaseData — normalização da categoria', () => {
  it.each(PURCHASE_CATEGORIES)('preserva a categoria canônica "%s"', async (category) => {
    const result = await extractWithCategory(category);

    expect(result.category).toBe(category);
    expect(isPurchaseCategory(result.category as string)).toBe(true);
  });

  it('mantém null como null', async () => {
    const result = await extractWithCategory(null);

    expect(result.category).toBeNull();
  });

  it('converte string vazia em null', async () => {
    const result = await extractWithCategory('');

    expect(result.category).toBeNull();
  });

  it('converte categoria em inglês/minúscula em null', async () => {
    const result = await extractWithCategory('electronics');

    expect(result.category).toBeNull();
  });

  it('converte categoria em minúscula sem acento em null', async () => {
    const result = await extractWithCategory('eletronicos');

    expect(result.category).toBeNull();
  });

  it('converte variação de acentuação/capitalização em null', async () => {
    const variations = ['Informatica', 'INFORMÁTICA', 'informática', 'Eletrônico'];

    for (const variation of variations) {
      const result = await extractWithCategory(variation);
      expect(result.category).toBeNull();
    }
  });

  it('converte categoria inventada/composta em null', async () => {
    const invented = ['Eletrônicos e acessórios', 'Geladeira', 'Outra'];

    for (const value of invented) {
      const result = await extractWithCategory(value);
      expect(result.category).toBeNull();
    }
  });

  it('não transforma categoria inválida em outra categoria válida', async () => {
    const result = await extractWithCategory('eletronicos');

    expect(result.category).toBeNull();
    expect(PURCHASE_CATEGORIES).not.toContain(result.category);
  });

  it('mantém os demais campos intactos quando a categoria é inválida', async () => {
    const result = await extractWithCategory('electronics');

    expect(result).toMatchObject({
      ...baseExtraction(),
      category: null,
    });
  });

  it('comporta-se igual quando a resposta não traz category (default null)', async () => {
    const provider = providerReturning(baseExtraction());
    const result = await extractPurchaseData(provider, document);

    expect(result.category).toBeNull();
    expect(result).toMatchObject(baseExtraction());
  });
});
