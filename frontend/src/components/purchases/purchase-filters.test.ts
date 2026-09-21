import { describe, expect, it } from 'vitest'
import type { Purchase } from '../../types/purchase.ts'
import {
  ALL_CATEGORIES,
  ALL_WARRANTIES,
  applyPurchaseFilters,
  EMPTY_FILTERS,
  type PurchaseFilters,
} from './purchase-filters.ts'

let seq = 0
function makePurchase(overrides: Partial<Purchase> = {}): Purchase {
  seq += 1
  return {
    id: `purchase-${seq}`,
    productName: 'Notebook Dell XPS',
    brand: 'Dell',
    model: 'XPS 15',
    serialNumber: null,
    store: 'Magazine Luiza',
    purchaseDate: '2026-01-15',
    price: '8749.90',
    category: 'Informática',
    warranty: null,
    createdAt: '2026-01-15T00:00:00.000Z',
    updatedAt: '2026-01-15T00:00:00.000Z',
    ...overrides,
  }
}

const filters = (patch: Partial<PurchaseFilters> = {}): PurchaseFilters => ({
  ...EMPTY_FILTERS,
  ...patch,
})

describe('applyPurchaseFilters — busca', () => {
  it('busca por nome do produto', () => {
    const list = [
      makePurchase({ productName: 'Máquina de Lavar' }),
      makePurchase({ productName: 'Geladeira Frost Free' }),
    ]

    const result = applyPurchaseFilters(list, filters({ query: 'geladeira' }))

    expect(result).toHaveLength(1)
    expect(result[0].productName).toBe('Geladeira Frost Free')
  })

  it('busca por marca', () => {
    const list = [
      makePurchase({ productName: 'Produto A', brand: 'Samsung', store: 'Loja 1' }),
      makePurchase({ productName: 'Produto B', brand: 'Brastemp', store: 'Loja 2' }),
    ]

    const result = applyPurchaseFilters(list, filters({ query: 'brastemp' }))

    expect(result).toHaveLength(1)
    expect(result[0].brand).toBe('Brastemp')
  })

  it('busca por loja', () => {
    const list = [
      makePurchase({ productName: 'Produto A', store: 'Magazine Luiza' }),
      makePurchase({ productName: 'Produto B', store: 'Casas Bahia' }),
    ]

    const result = applyPurchaseFilters(list, filters({ query: 'casas' }))

    expect(result).toHaveLength(1)
    expect(result[0].store).toBe('Casas Bahia')
  })

  it('busca por número de série', () => {
    const list = [
      makePurchase({ productName: 'Produto A', serialNumber: 'SN-ABC-12345' }),
      makePurchase({ productName: 'Produto B', serialNumber: 'SN-XYZ-99999' }),
    ]

    const result = applyPurchaseFilters(list, filters({ query: 'abc-123' }))

    expect(result).toHaveLength(1)
    expect(result[0].serialNumber).toBe('SN-ABC-12345')
  })

  it('número de série null não causa erro nem falso positivo', () => {
    const list = [
      makePurchase({ productName: 'Produto A', serialNumber: null }),
      makePurchase({ productName: 'Produto B', serialNumber: null }),
    ]

    expect(() => applyPurchaseFilters(list, filters({ query: 'abc' }))).not.toThrow()
    expect(applyPurchaseFilters(list, filters({ query: 'abc' }))).toHaveLength(0)
  })

  it('número de série vazio ("") não causa erro nem falso positivo', () => {
    const list = [
      makePurchase({ productName: 'Produto A', serialNumber: '' }),
      makePurchase({ productName: 'Produto B', serialNumber: '' }),
    ]

    expect(() => applyPurchaseFilters(list, filters({ query: 'abc' }))).not.toThrow()
    expect(applyPurchaseFilters(list, filters({ query: 'abc' }))).toHaveLength(0)
  })

  it('é case-insensitive (inclui número de série)', () => {
    const list = [
      makePurchase({ productName: 'Produto A', serialNumber: 'SN-ABC-12345' }),
      makePurchase({ productName: 'Produto B', serialNumber: 'SN-XYZ-99999' }),
    ]

    const upper = applyPurchaseFilters(list, filters({ query: 'ABC' }))
    const lower = applyPurchaseFilters(list, filters({ query: 'abc' }))

    expect(upper).toHaveLength(1)
    expect(lower).toHaveLength(1)
    expect(upper[0].id).toBe(lower[0].id)
  })

  it('ignora espaços nas extremidades da busca', () => {
    const list = [
      makePurchase({ productName: 'Geladeira Frost Free' }),
      makePurchase({ productName: 'Máquina de Lavar' }),
    ]

    const result = applyPurchaseFilters(list, filters({ query: '  geladeira  ' }))

    expect(result).toHaveLength(1)
    expect(result[0].productName).toBe('Geladeira Frost Free')
  })

  it('query só com espaços retorna todas as compras', () => {
    const list = [makePurchase(), makePurchase(), makePurchase()]

    expect(applyPurchaseFilters(list, filters({ query: '   ' }))).toHaveLength(3)
  })

  it('adicionar serialNumber não altera os resultados por produto, marca ou loja', () => {
    // Compra cujo serial NÃO casa com o termo, mas cujo produto casa.
    const list = [
      makePurchase({
        productName: 'Geladeira Frost Free',
        brand: 'Brastemp',
        store: 'Casas Bahia',
        serialNumber: 'SN-ZZZ-000',
      }),
      makePurchase({
        productName: 'Notebook Dell',
        brand: 'Dell',
        store: 'Magazine Luiza',
        serialNumber: 'SN-AAA-111',
      }),
    ]

    // Resultados que já eram encontrados antes de incluir serialNumber.
    const byProduct = applyPurchaseFilters(list, filters({ query: 'geladeira' }))
    const byBrand = applyPurchaseFilters(list, filters({ query: 'brastemp' }))
    const byStore = applyPurchaseFilters(list, filters({ query: 'magazine' }))

    expect(byProduct.map((p) => p.productName)).toEqual(['Geladeira Frost Free'])
    expect(byBrand.map((p) => p.brand)).toEqual(['Brastemp'])
    expect(byStore.map((p) => p.store)).toEqual(['Magazine Luiza'])
  })

  it('busca sem correspondência retorna lista vazia', () => {
    const list = [
      makePurchase({ productName: 'Produto A', brand: 'Marca A', store: 'Loja A' }),
      makePurchase({ productName: 'Produto B', brand: 'Marca B', store: 'Loja B' }),
    ]

    expect(applyPurchaseFilters(list, filters({ query: 'inexistente' }))).toHaveLength(0)
  })

  it('não muta o array original', () => {
    const list = [
      makePurchase({ productName: 'Produto A' }),
      makePurchase({ productName: 'Produto B' }),
    ]
    const snapshot = list.map((p) => p.id)

    applyPurchaseFilters(list, filters({ query: 'produto' }))

    expect(list.map((p) => p.id)).toEqual(snapshot)
  })
})

describe('applyPurchaseFilters — combinação com filtros existentes', () => {
  it('busca por serialNumber combinada com filtro de categoria', () => {
    const list = [
      makePurchase({ category: 'Informática', serialNumber: 'SN-ABC-12345' }),
      makePurchase({ category: 'Eletrodomésticos', serialNumber: 'SN-ABC-12345' }),
      makePurchase({ category: 'Informática', serialNumber: 'SN-XYZ-99999' }),
    ]

    const result = applyPurchaseFilters(
      list,
      filters({ query: 'abc-123', category: 'Informática' }),
    )

    expect(result).toHaveLength(1)
    expect(result[0].category).toBe('Informática')
    expect(result[0].serialNumber).toBe('SN-ABC-12345')
  })

  it('estado padrão (sem busca) retorna todas as compras', () => {
    const list = [makePurchase(), makePurchase()]
    const result = applyPurchaseFilters(list, {
      query: '',
      category: ALL_CATEGORIES,
      warranty: ALL_WARRANTIES,
      sort: 'recent',
    })
    expect(result).toHaveLength(2)
  })
})
