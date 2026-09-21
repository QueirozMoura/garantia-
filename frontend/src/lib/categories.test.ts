// Testes da fonte única de categorias (frontend/src/lib/categories.ts).
import { describe, expect, it } from 'vitest'
import {
  CUSTOM_CATEGORY_OPTION,
  isStandardCategory,
  PURCHASE_CATEGORIES,
} from './categories.ts'

describe('PURCHASE_CATEGORIES — lista centralizada', () => {
  it('contém as categorias padronizadas esperadas', () => {
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
    ])
  })

  it('não contém duplicatas', () => {
    expect(new Set(PURCHASE_CATEGORIES).size).toBe(PURCHASE_CATEGORIES.length)
  })
})

describe('isStandardCategory', () => {
  it('reconhece uma categoria da lista', () => {
    expect(isStandardCategory('Informática')).toBe(true)
  })

  it('trata valores fora da lista como personalizados', () => {
    expect(isStandardCategory('electronics')).toBe(false)
    expect(isStandardCategory('Geladeira')).toBe(false)
    expect(isStandardCategory('')).toBe(false)
  })
})

describe('CUSTOM_CATEGORY_OPTION', () => {
  it('não colide com nenhuma categoria da lista', () => {
    expect(PURCHASE_CATEGORIES as readonly string[]).not.toContain(CUSTOM_CATEGORY_OPTION)
  })
})
