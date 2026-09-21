import { describe, expect, it } from 'vitest'
import type { WarrantyWithPurchase } from '../../types/warranty.ts'
import {
  ALL_WARRANTY_STATUSES,
  applyWarrantyFilters,
  DEFAULT_SORT,
  EMPTY_FILTERS,
  hasActiveFilters,
  type WarrantyFilters,
} from './warranty-filters.ts'

/**
 * Datas relativas a um `now` fixo e determinístico, todas em meia-noite UTC
 * (mesmo formato que o backend envia). Evita depender do relógio real.
 */
const NOW = new Date('2026-06-15T00:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000
const isoDaysFromNow = (days: number) =>
  new Date(NOW.getTime() + days * DAY).toISOString()

let seq = 0
function makeWarranty(
  overrides: Partial<WarrantyWithPurchase> = {},
  purchase: Partial<WarrantyWithPurchase['purchase']> = {},
): WarrantyWithPurchase {
  seq += 1
  return {
    id: `warranty-${seq}`,
    purchaseId: `purchase-${seq}`,
    durationMonths: 12,
    startDate: isoDaysFromNow(-100),
    endDate: isoDaysFromNow(200),
    createdAt: isoDaysFromNow(-100),
    updatedAt: isoDaysFromNow(-100),
    purchase: {
      id: `purchase-${seq}`,
      productName: 'Notebook Dell XPS',
      brand: 'Dell',
      model: 'XPS 15',
      purchaseDate: isoDaysFromNow(-100),
      category: 'Informática',
      ...purchase,
    },
    ...overrides,
  }
}

const filters = (patch: Partial<WarrantyFilters> = {}): WarrantyFilters => ({
  ...EMPTY_FILTERS,
  ...patch,
})

describe('applyWarrantyFilters — busca', () => {
  it('busca por nome do produto (case-insensitive)', () => {
    const list = [
      makeWarranty({}, { productName: 'Máquina de Lavar' }),
      makeWarranty({}, { productName: 'Geladeira Frost Free' }),
    ]

    const result = applyWarrantyFilters(list, filters({ query: 'geladeira' }), NOW)

    expect(result).toHaveLength(1)
    expect(result[0].purchase.productName).toBe('Geladeira Frost Free')
  })

  it('busca por marca', () => {
    const list = [
      makeWarranty({}, { brand: 'Samsung' }),
      makeWarranty({}, { brand: 'Brastemp' }),
    ]

    const result = applyWarrantyFilters(list, filters({ query: 'brastemp' }), NOW)

    expect(result).toHaveLength(1)
    expect(result[0].purchase.brand).toBe('Brastemp')
  })

  it('busca por loja quando o campo está disponível no payload', () => {
    const withStore = makeWarranty()
    const purchaseWithStore = {
      ...withStore.purchase,
      store: 'Magazine Luiza',
    }
    const list = [
      { ...withStore, purchase: purchaseWithStore } as WarrantyWithPurchase,
      makeWarranty({}, { productName: 'Outro produto' }),
    ]

    const result = applyWarrantyFilters(list, filters({ query: 'magazine' }), NOW)

    expect(result).toHaveLength(1)
    expect(result[0].purchase.productName).toBe('Notebook Dell XPS')
  })

  it('ignora a loja quando ela não existe e não quebra', () => {
    const list = [makeWarranty(), makeWarranty()]

    expect(() =>
      applyWarrantyFilters(list, filters({ query: 'loja inexistente' }), NOW),
    ).not.toThrow()
    expect(applyWarrantyFilters(list, filters({ query: 'qualquer' }), NOW)).toHaveLength(
      0,
    )
  })
})

describe('applyWarrantyFilters — filtro por status', () => {
  const list = [
    makeWarranty({ endDate: isoDaysFromNow(200) }), // active
    makeWarranty({ endDate: isoDaysFromNow(10) }), // expiring
    makeWarranty({ endDate: isoDaysFromNow(-10) }), // expired
    makeWarranty({ startDate: isoDaysFromNow(30), endDate: isoDaysFromNow(395) }), // upcoming
  ]

  it('filtra por "Ativa"', () => {
    const result = applyWarrantyFilters(list, filters({ status: 'active' }), NOW)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(list[0].id)
  })

  it('filtra por "Vencendo em breve"', () => {
    const result = applyWarrantyFilters(list, filters({ status: 'expiring' }), NOW)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(list[1].id)
  })

  it('filtra por "Expirada"', () => {
    const result = applyWarrantyFilters(list, filters({ status: 'expired' }), NOW)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(list[2].id)
  })

  it('filtra por "Ainda não iniciada"', () => {
    const result = applyWarrantyFilters(list, filters({ status: 'upcoming' }), NOW)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(list[3].id)
  })

  it('sem filtro retorna todas', () => {
    const result = applyWarrantyFilters(
      list,
      filters({ status: ALL_WARRANTY_STATUSES }),
      NOW,
    )
    expect(result).toHaveLength(4)
  })
})

describe('applyWarrantyFilters — ordenação por vencimento', () => {
  const earlier = makeWarranty({ endDate: isoDaysFromNow(5) })
  const later = makeWarranty({ endDate: isoDaysFromNow(300) })
  const middle = makeWarranty({ endDate: isoDaysFromNow(90) })
  const list = [later, earlier, middle]

  it('vencimento mais próximo primeiro (padrão)', () => {
    const result = applyWarrantyFilters(list, filters(), NOW)
    expect(result.map((w) => w.id)).toEqual([earlier.id, middle.id, later.id])
  })

  it('vencimento mais distante primeiro', () => {
    const result = applyWarrantyFilters(list, filters({ sort: 'due-latest' }), NOW)
    expect(result.map((w) => w.id)).toEqual([later.id, middle.id, earlier.id])
  })

  it('empate de endDate é determinístico (desempate por id)', () => {
    const a = makeWarranty({ id: 'aaa', endDate: isoDaysFromNow(50) })
    const b = makeWarranty({ id: 'bbb', endDate: isoDaysFromNow(50) })
    const result = applyWarrantyFilters([b, a], filters(), NOW)
    expect(result.map((w) => w.id)).toEqual(['aaa', 'bbb'])
  })
})

describe('applyWarrantyFilters — combinações e imutabilidade', () => {
  it('combina busca + status', () => {
    const list = [
      makeWarranty({ endDate: isoDaysFromNow(10) }, { productName: 'Cafeteira' }),
      makeWarranty({ endDate: isoDaysFromNow(200) }, { productName: 'Cafeteira' }),
      makeWarranty({ endDate: isoDaysFromNow(10) }, { productName: 'Torradeira' }),
    ]

    const result = applyWarrantyFilters(
      list,
      filters({ query: 'cafeteira', status: 'expiring' }),
      NOW,
    )

    expect(result).toHaveLength(1)
    expect(result[0].purchase.productName).toBe('Cafeteira')
    expect(result[0].endDate).toBe(isoDaysFromNow(10))
  })

  it('não muta o array original', () => {
    const list = [
      makeWarranty({ endDate: isoDaysFromNow(300) }),
      makeWarranty({ endDate: isoDaysFromNow(5) }),
    ]
    const snapshot = list.map((w) => w.id)

    applyWarrantyFilters(list, filters(), NOW)

    expect(list.map((w) => w.id)).toEqual(snapshot)
  })
})

describe('hasActiveFilters', () => {
  it('estado padrão não tem filtros ativos', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false)
    expect(DEFAULT_SORT).toBe('due-soonest')
  })

  it('detecta busca, status e ordenação', () => {
    expect(hasActiveFilters(filters({ query: 'x' }))).toBe(true)
    expect(hasActiveFilters(filters({ status: 'expired' }))).toBe(true)
    expect(hasActiveFilters(filters({ sort: 'due-latest' }))).toBe(true)
  })

  it('busca só com espaços não conta como ativa', () => {
    expect(hasActiveFilters(filters({ query: '   ' }))).toBe(false)
  })
})
