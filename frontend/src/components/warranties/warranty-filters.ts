import { getWarrantyStatus, type WarrantyStatus } from '../../lib/warranty-status.ts'
import type { WarrantyWithPurchase } from '../../types/warranty.ts'

/**
 * Busca, filtro por status e ordenação da listagem de garantias.
 *
 * Tudo acontece no frontend sobre os dados que `GET /warranties` já retornou:
 * nenhuma função aqui dispara requisição, e o array recebido NUNCA é mutado —
 * sempre trabalhamos sobre uma cópia. O status de garantia é derivado pelo
 * helper central (`lib/warranty-status.ts`), nunca recalculado aqui.
 *
 * Mesma abordagem de `purchases/purchase-filters.ts` e
 * `documents/document-filters.ts`.
 */

/** Opções de ordenação expostas no controle "Ordenar". */
export type WarrantySort = 'due-soonest' | 'due-latest'

/** Valor do filtro de status que representa "sem filtro". */
export const ALL_WARRANTY_STATUSES = 'all'

/** Ordenação padrão — vencimento mais próximo primeiro. */
export const DEFAULT_SORT: WarrantySort = 'due-soonest'

/**
 * Opções do filtro "Status". Os valores são exatamente os status derivados pelo
 * helper central (`warranty-status.ts`), sem estados inventados aqui.
 */
export const WARRANTY_STATUS_OPTIONS: { value: WarrantyStatus; label: string }[] = [
  { value: 'active', label: 'Ativa' },
  { value: 'expiring', label: 'Vencendo em breve' },
  { value: 'expired', label: 'Expirada' },
  { value: 'upcoming', label: 'Ainda não iniciada' },
]

export const SORT_OPTIONS: { value: WarrantySort; label: string }[] = [
  { value: 'due-soonest', label: 'Vencimento mais próximo' },
  { value: 'due-latest', label: 'Vencimento mais distante' },
]

export interface WarrantyFilters {
  /** Texto digitado na busca (produto ou marca). */
  query: string
  /** Status selecionado ou `ALL_WARRANTY_STATUSES`. */
  status: string
  /** Ordenação selecionada. */
  sort: WarrantySort
}

/** Estado inicial dos controles — sempre restaurado por "Limpar filtros". */
export const EMPTY_FILTERS: WarrantyFilters = {
  query: '',
  status: ALL_WARRANTY_STATUSES,
  sort: DEFAULT_SORT,
}

/** Normaliza texto para comparação: sem espaços nas pontas, minúsculo. */
const normalize = (value: string) => value.trim().toLowerCase()

/**
 * Verifica se a garantia corresponde ao termo buscado em `productName` ou
 * `brand` da compra relacionada. Esses são os únicos campos textuais de
 * identificação expostos por `GET /warranties` (o payload não inclui `store`
 * nem `serialNumber`).
 */
function matchesQuery(warranty: WarrantyWithPurchase, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true
  const { purchase } = warranty
  const haystacks = [purchase.productName, purchase.brand]
  return haystacks.some(
    (field) => typeof field === 'string' && normalize(field).includes(normalizedQuery),
  )
}

/** Instante (epoch ms) de `endDate`; `NaN` se inválido. */
const endDateValue = (warranty: WarrantyWithPurchase) => Date.parse(warranty.endDate)

/**
 * Compara `endDate` como instantes absolutos (epoch ms). Datas inválidas vão
 * sempre para o fim, sem quebrar a ordenação. Empates são desempatados por `id`
 * para manter a ordem determinística.
 */
function compareByEndDate(a: WarrantyWithPurchase, b: WarrantyWithPurchase): number {
  const aTime = endDateValue(a)
  const bTime = endDateValue(b)
  if (Number.isNaN(aTime) && Number.isNaN(bTime)) return a.id.localeCompare(b.id)
  if (Number.isNaN(aTime)) return 1
  if (Number.isNaN(bTime)) return -1
  if (aTime !== bTime) return aTime - bTime
  return a.id.localeCompare(b.id)
}

/** Cópia ordenada por vencimento, preservando o array de entrada intacto. */
function sortWarranties(
  warranties: WarrantyWithPurchase[],
  sort: WarrantySort,
): WarrantyWithPurchase[] {
  const copy = [...warranties]
  switch (sort) {
    case 'due-soonest':
      return copy.sort(compareByEndDate)
    case 'due-latest':
      return copy.sort((a, b) => compareByEndDate(b, a))
    default:
      return copy
  }
}

/**
 * Aplica busca + filtro por status e, em seguida, ordenação sobre a lista
 * completa. O array de entrada nunca é modificado. `now` pode ser injetado para
 * manter o status determinístico em testes; o padrão são os dados da garantia.
 */
export function applyWarrantyFilters(
  warranties: WarrantyWithPurchase[],
  filters: WarrantyFilters,
  now: Date = new Date(),
): WarrantyWithPurchase[] {
  const normalizedQuery = normalize(filters.query)
  const filtered = warranties.filter((warranty) => {
    if (!matchesQuery(warranty, normalizedQuery)) return false
    if (
      filters.status !== ALL_WARRANTY_STATUSES &&
      getWarrantyStatus(warranty, now).status !== filters.status
    ) {
      return false
    }
    return true
  })
  return sortWarranties(filtered, filters.sort)
}

/** `true` quando a busca, o status ou a ordenação está diferente do padrão. */
export function hasActiveFilters(filters: WarrantyFilters): boolean {
  return (
    normalize(filters.query) !== '' ||
    filters.status !== ALL_WARRANTY_STATUSES ||
    filters.sort !== DEFAULT_SORT
  )
}
