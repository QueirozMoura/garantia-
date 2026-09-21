  // Testes da fonte canônica de categorias do backend
// (backend/src/modules/categories.ts).
import { describe, expect, it } from 'vitest';

import {
  isPurchaseCategory,
  PURCHASE_CATEGORIES,
  type PurchaseCategory,
} from '../src/modules/categories.js';

describe('PURCHASE_CATEGORIES', () => {
  it('cobre exatamente as categorias canônicas (sem "Outra")', () => {
    expect(PURCHASE_CATEGORIES).toEqual([
      'Informática',
      'Eletrônicos',
      'Eletrodomésticos',
      'Móveis',
      'Vestuário',
      'Casa e decoração',
      'Esportes',
      'Automotivo',
      'Outros',
    ]);
  });

  it('não inclui o rótulo de interface "Outra"', () => {
    expect(PURCHASE_CATEGORIES as readonly string[]).not.toContain('Outra');
  });

  it('não contém duplicatas', () => {
    expect(new Set(PURCHASE_CATEGORIES).size).toBe(PURCHASE_CATEGORIES.length);
  });
});

describe('isPurchaseCategory', () => {
  it('reconhece uma categoria canônica', () => {
    expect(isPurchaseCategory('Informática')).toBe(true);
    // Narrowing de tipo: compila sem cast.
    const value: string = 'Móveis';
    if (isPurchaseCategory(value)) {
      const narrowed: PurchaseCategory = value;
      expect(narrowed).toBe('Móveis');
    }
  });

  it('rejeita valores fora da lista', () => {
    expect(isPurchaseCategory('Outra')).toBe(false);
    expect(isPurchaseCategory('electronics')).toBe(false);
    expect(isPurchaseCategory('')).toBe(false);
  });
});
