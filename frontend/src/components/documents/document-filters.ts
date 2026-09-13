import type { DocumentType, DocumentWithPurchase } from '../../types/document.ts'

/**
 * Busca, filtros e ordenação da listagem geral de documentos.
 *
 * Tudo acontece no frontend sobre os dados que `GET /documents` já retornou:
 * nenhuma função aqui dispara requisição, e o array recebido NUNCA é mutado —
 * sempre trabalhamos sobre uma cópia. Os campos da compra relacionados
 * (`productName`, `brand`, `store`) já vêm embutidos no próprio GET /documents.
 */

/** Opções de ordenação expostas no controle "Ordenar". */
export type DocumentSort = 'recent' | 'oldest' | 'name-asc' | 'name-desc'

/** Janela de tempo (relativa a `createdAt`) usada pelo filtro "Período". */
export type DocumentPeriod = 'all' | 'last-7-days' | 'last-30-days' | 'older'

/** Valor do filtro de tipo que representa "sem filtro". */
export const ALL_DOCUMENT_TYPES = 'all'
/** Valor do filtro de período que representa "sem filtro". */
export const ALL_PERIODS: DocumentPeriod = 'all'
/** Ordenação padrão — a mesma ordem em que a API entrega (mais recentes). */
export const DEFAULT_SORT: DocumentSort = 'recent'

/** Dias considerados nas opções "Últimos N dias" do filtro de período. */
const LAST_7_DAYS = 7
const LAST_30_DAYS = 30
/** Milissegundos em um dia — usado para montar os cortes em epoch ms. */
const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Opções do filtro "Tipo". Os valores são os tipos que o backend retorna. */
export const TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: 'INVOICE', label: 'Nota fiscal' },
  { value: 'RECEIPT', label: 'Recibo' },
  { value: 'WARRANTY', label: 'Garantia' },
  { value: 'OTHER', label: 'Outro' },
]

/** Opções do filtro "Período" (sempre a partir do `createdAt`). */
export const PERIOD_OPTIONS: { value: DocumentPeriod; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'last-7-days', label: 'Últimos 7 dias' },
  { value: 'last-30-days', label: 'Últimos 30 dias' },
  { value: 'older', label: 'Mais antigos' },
]

export const SORT_OPTIONS: { value: DocumentSort; label: string }[] = [
  { value: 'recent', label: 'Mais recentes' },
  { value: 'oldest', label: 'Mais antigos' },
  { value: 'name-asc', label: 'Nome A-Z' },
  { value: 'name-desc', label: 'Nome Z-A' },
]

export interface DocumentFilters {
  /** Texto digitado na busca (nome do documento/arquivo, produto, marca ou loja). */
  query: string
  /** Tipo selecionado ou `ALL_DOCUMENT_TYPES`. */
  type: string
  /** Período selecionado a partir de `createdAt`. */
  period: DocumentPeriod
  /** Ordenação selecionada. */
  sort: DocumentSort
}

/** Estado inicial dos controles — sempre restaurado por "Limpar filtros". */
export const EMPTY_FILTERS: DocumentFilters = {
  query: '',
  type: ALL_DOCUMENT_TYPES,
  period: ALL_PERIODS,
  sort: DEFAULT_SORT,
}

/** Normaliza texto para comparação: sem espaços nas pontas, minúsculo. */
const normalize = (value: string) => value.trim().toLowerCase()

/**
 * Verifica se o documento corresponde ao termo buscado em `name`, `fileName` e,
 * quando presentes, `productName`, `brand` e `store` da compra relacionada.
 * Campos opcionais nulos são simplesmente ignorados.
 */
function matchesQuery(document: DocumentWithPurchase, normalizedQuery: string): boolean {
  if (!normalizedQuery) return true
  const haystacks = [
    document.name,
    document.fileName,
    document.purchase.productName,
    document.purchase.brand,
    document.purchase.store,
  ]
  return haystacks.some(
    (field) => typeof field === 'string' && normalize(field).includes(normalizedQuery),
  )
}

/** Instante (epoch ms) em que o documento foi criado; `NaN` se inválido. */
const createdAtValue = (document: DocumentWithPurchase) => Date.parse(document.createdAt)

/**
 * Compara `createdAt` como instantes absolutos (epoch ms). Datas inválidas vão
 * sempre para o fim, sem quebrar a ordenação.
 */
function compareByCreatedAt(a: DocumentWithPurchase, b: DocumentWithPurchase): number {
  const aTime = createdAtValue(a)
  const bTime = createdAtValue(b)
  if (Number.isNaN(aTime)) return 1
  if (Number.isNaN(bTime)) return -1
  return aTime - bTime
}

/**
 * `true` quando o documento entra na janela de período, usando `createdAt`
 * comparado como epoch ms contra um corte relativo a `now`.
 *
 * As comparações são feitas em instantes absolutos — nada de `getDate()`/
 * componentes locais — para não depender acidentalmente do timezone do
 * navegador. Como a API devolve `createdAt` em ISO (UTC), converter ambos os
 * lados para ms preserva o instante correto em qualquer fuso.
 *
 * - `all`: sempre dentro.
 * - `last-7-days`: criado há 7 dias ou menos.
 * - `last-30-days`: criado há 30 dias ou menos.
 * - `older`: criado antes dos últimos 30 dias (o complemento do anterior).
 */
function matchesPeriod(
  document: DocumentWithPurchase,
  period: DocumentPeriod,
  now: number,
): boolean {
  if (period === 'all') return true
  const time = createdAtValue(document)
  if (Number.isNaN(time)) return false
  if (period === 'last-7-days') return time >= now - LAST_7_DAYS * MS_PER_DAY
  if (period === 'last-30-days') return time >= now - LAST_30_DAYS * MS_PER_DAY
  // 'older': fora da janela dos últimos 30 dias.
  return time < now - LAST_30_DAYS * MS_PER_DAY
}

/**
 * Compara nomes para ordenação A-Z/Z-A respeitando acentos e maiúsculas do
 * português (`Intl.Collator` com `sensitivity: 'base'` = case-insensitive).
 */
const collator = new Intl.Collator('pt-BR', { sensitivity: 'base' })
function compareNames(a: DocumentWithPurchase, b: DocumentWithPurchase): number {
  return collator.compare(a.name, b.name)
}

/**
 * Cópia ordenada do array. `recent` preserva exatamente a ordem recebida da API
 * (que já vem por `createdAt` desc), sem ordenar de novo.
 */
function sortDocuments(
  documents: DocumentWithPurchase[],
  sort: DocumentSort,
): DocumentWithPurchase[] {
  const copy = [...documents]
  switch (sort) {
    case 'recent':
      return copy
    case 'oldest':
      return copy.sort(compareByCreatedAt)
    case 'name-asc':
      return copy.sort(compareNames)
    case 'name-desc':
      return copy.sort((a, b) => compareNames(b, a))
    default:
      return copy
  }
}

/**
 * Aplica busca + tipo + período e, em seguida, ordenação sobre a lista completa.
 * O array de entrada nunca é modificado. `now` pode ser injetado para manter o
 * filtro de período determinístico em testes; o padrão é o instante atual.
 */
export function applyDocumentFilters(
  documents: DocumentWithPurchase[],
  filters: DocumentFilters,
  now: number = Date.now(),
): DocumentWithPurchase[] {
  const normalizedQuery = normalize(filters.query)
  const filtered = documents.filter((document) => {
    if (!matchesQuery(document, normalizedQuery)) return false
    if (filters.type !== ALL_DOCUMENT_TYPES && document.type !== filters.type) {
      return false
    }
    if (!matchesPeriod(document, filters.period, now)) return false
    return true
  })
  return sortDocuments(filtered, filters.sort)
}

/** `true` quando a busca ou algum filtro está diferente do padrão. */
export function hasActiveFilters(filters: DocumentFilters): boolean {
  return (
    normalize(filters.query) !== '' ||
    filters.type !== ALL_DOCUMENT_TYPES ||
    filters.period !== ALL_PERIODS ||
    filters.sort !== DEFAULT_SORT
  )
}
