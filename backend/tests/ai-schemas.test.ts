// Testes unitários dos schemas de IA (backend/src/services/ai/ai.schemas.ts).
//
// Foco: o campo `category` da extração precisa existir e ser preservado pelo
// parse (ainda SEM validar contra a lista canônica de categorias). Garantimos
// também que os campos existentes continuam funcionando.
import { describe, expect, it } from 'vitest';

import { extractedPurchaseDataSchema } from '../src/services/ai/ai.schemas.js';

const validPayload = () => ({
  productName: 'Notebook Dell XPS 15',
  brand: 'Dell',
  model: 'XPS 15 9530',
  purchaseDate: '2024-05-10',
  price: 8749.9,
  store: 'Magazine Luiza',
  invoiceNumber: '12345',
  warrantyMonths: 12,
});

describe('extractedPurchaseDataSchema — category', () => {
  it('preserva uma categoria informada pela IA', () => {
    const result = extractedPurchaseDataSchema.parse({
      ...validPayload(),
      category: 'Informática',
    });

    expect(result.category).toBe('Informática');
  });

  it('preserva categoria com acentos e espaços internos (sem validar a lista ainda)', () => {
    const result = extractedPurchaseDataSchema.parse({
      ...validPayload(),
      category: 'Casa e decoração',
    });

    expect(result.category).toBe('Casa e decoração');
  });

  it('aceita category null', () => {
    const result = extractedPurchaseDataSchema.parse({
      ...validPayload(),
      category: null,
    });

    expect(result.category).toBeNull();
  });

  it('trata categoria ausente como null (default)', () => {
    const result = extractedPurchaseDataSchema.parse(validPayload());

    expect(result.category).toBeNull();
  });

  it('trata categoria vazia/só espaços como null', () => {
    const empty = extractedPurchaseDataSchema.parse({
      ...validPayload(),
      category: '',
    });
    const blank = extractedPurchaseDataSchema.parse({
      ...validPayload(),
      category: '   ',
    });

    expect(empty.category).toBeNull();
    expect(blank.category).toBeNull();
  });
});

describe('extractedPurchaseDataSchema — campos existentes', () => {
  it('continua interpretando todos os demais campos', () => {
    const result = extractedPurchaseDataSchema.parse(validPayload());

    expect(result).toMatchObject({
      productName: 'Notebook Dell XPS 15',
      brand: 'Dell',
      model: 'XPS 15 9530',
      purchaseDate: '2024-05-10',
      price: 8749.9,
      store: 'Magazine Luiza',
      invoiceNumber: '12345',
      warrantyMonths: 12,
    });
  });

  it('mantém o default null dos campos ausentes', () => {
    const result = extractedPurchaseDataSchema.parse({});

    expect(result).toEqual({
      productName: null,
      brand: null,
      model: null,
      purchaseDate: null,
      price: null,
      store: null,
      invoiceNumber: null,
      warrantyMonths: null,
      category: null,
    });
  });
});
