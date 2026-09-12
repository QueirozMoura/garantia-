import type { Purchase } from '../../types/purchase.ts'
import {
  getPurchaseWarrantyStatus,
  type PurchaseWarrantyStatus,
} from '../../lib/warranty-status.ts'

/**
 * Busca, filtros e ordenação da listagem de compras.
 *
 * Tudo acontece no frontend sobre os dados que `GET /purchases` já retornou:
 * nenhuma função aqui dispara requisição, e o array recebido NUNCA é mutado —
 * sempre trabalhamos sobre uma cópia. O status de garantia é derivado do campo
 * `warranty` que o próprio GET /purchases já devolve.
 */

/** Opções de ordenação expostas no controle "Ordenar". */
export type PurchaseSort =
  'recent' | 'oldest' | 'price-desc' | 'price-asc' | 'name-asc' | 'name-desc'

/** Valor do filtro de categoria que representa "sem filtro". */
export const ALL_CATEGORIES = 'all'
/** Valor do filtro de garantia que representa "sem filtro". */
export const ALL_WARRANTIES = 'all'
/** Ordenação padrão — a mesma ordem em que a API entrega (mais recentes). */
export const DEFAULT_SORT: PurchaseSort = 'recent'

/**
 * Opções do filtro "Garantia". Os valores são exatamente os status derivados
 * pelo helper central (`warranty-status.ts`), sem estados inventados aqui.
 */
export const WARRANTY_OPTIONS: { value: PurchaseWarrantyStatus; label: string }[] = [
  { value: 'active', label: 'Ativa' },
  { value: 'expiring', label: 'Vencendo em breve' },
  { value: 'expired', label: 'Expirada' },
  { value: 'none', label: 'Sem garantia' },
]

export const SORT_OPTIONS: { value: PurchaseSort; label: string }[] = [
  { value: 'recent', label: 'Mais recentes' },
  { value: 'oldest', label: 'Mais antigas' },
  { value: 'price-desc', label: 'Maior valor' },
  { value: 'price-asc', label: 'Menor valor' },
  { value: 'name-asc', label: 'Nome: A–Z' },
  { value: 'name-desc', label: 'Nome: Z–A' },
]

export interface PurchaseFilters {
  /** Texto digitado na busca (produto, marca ou loja). */
  query: string
  /** Categoria selecionada ou `ALL_CATEGORIES`. */
  category: string
  /** Status de garantia selecionado ou `ALL_WARRANTIES`. */
  warranty: string
  /** Ordenação selecionada. */
  sort: PurchaseSort
}

/** Estado inicial dos controles — sempre restaurado por "Limpar filtros". */
export const EMPTY_FILTERS: PurchaseFilters = {
  query: '',
  category: ALL_CATEGORIES,
  warranty: ALL_WARRANTIES,
  sort: DEFAULT_SORT,
}

/** Normaliza texto para comparação: sem espaços nas pontas, minúsculo. */
const normalize = (value: string) => value.trim().toLowerCase()

/**
 * Verifica se a compra corresponde ao termo buscado em `productName`, `brand`
 * ou `store`. Campos opcionais nulos são simplesmente ignorados.
 */
function matchesQuery(purchase: Purchase, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true
  const haystacks = [purchase.productName, purchase.brand, purchase.store]
  return haystacks.some(
    (field) => typeof field === 'string' && normalize(field).includes(normalizedQuery),
  )
}

/** Converte `price` (string "0.00" vinda do backend) em número comparável. */
const priceValue = (purchase: Purchase) => {
  const value = Number.parseFloat(purchase.price)
  return Number.isFinite(value) ? value : 0
}

/**
 * Compara strings para ordenação A–Z/Z–A respeitando acentos e maiúsculas do
 * português. `undefined`/`null` vão sempre para o fim, sem quebrar a ordem.
 */
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' })
function compareNames(a: Purchase, b: Purchase): number {
  return collator.compare(a.productName, b.productName)
}

/**
 * Cópia ordenada do array. `recent` preserva exatamente a ordem recebida da API
 * (que já vem por `createdAt` desc), sem ordenar de novo.
 */
function sortPurchases(purchases: Purchase[], sort: PurchaseSort): Purchase[] {
  const copy = [...purchases]
  switch (sort) {
    case 'recent':
      return copy
    case 'oldest':
      return copy.reverse()
    case 'price-desc':
      return copy.sort((a, b) => priceValue(b) - priceValue(a))
    case 'price-asc':
      return copy.sort((a, b) => priceValue(a) - priceValue(b))
    case 'name-asc':
      return copy.sort(compareNames)
    case 'name-desc':
      return copy.sort((a, b) => compareNames(b, a))
    default:
      return copy
  }
}

/**
 * Aplica busca + filtros + ordenação sobre a lista completa.
 * O array de entrada nunca é modificado.
 */
export function applyPurchaseFilters(
  purchases: Purchase[],
  filters: PurchaseFilters,
): Purchase[] {
  const normalizedQuery = normalize(filters.query)
  const filtered = purchases.filter((purchase) => {
    if (!matchesQuery(purchase, normalizedQuery)) return false
    if (filters.category !== ALL_CATEGORIES && purchase.category !== filters.category) {
      return false
    }
    if (
      filters.warranty !== ALL_WARRANTIES &&
      getPurchaseWarrantyStatus(purchase.warranty).status !== filters.warranty
    ) {
      return false
    }
    return true
  })
  return sortPurchases(filtered, filters.sort)
}

/**
 * Categorias disponíveis derivadas dos dados carregados (sem lista fixa),
 * em ordem alfabética e sem repetições.
 */
export function getAvailableCategories(purchases: Purchase[]): string[] {
  const unique = new Set<string>()
  for (const purchase of purchases) {
    const category = purchase.category?.trim()
    if (category) unique.add(category)
  }
  return [...unique].sort((a, b) => collator.compare(a, b))
}

/** `true` quando a busca ou algum filtro está diferente do padrão. */
export function hasActiveFilters(filters: PurchaseFilters): boolean {
  return (
    normalize(filters.query) !== '' ||
    filters.category !== ALL_CATEGORIES ||
    filters.warranty !== ALL_WARRANTIES ||
    filters.sort !== DEFAULT_SORT
  )
}
