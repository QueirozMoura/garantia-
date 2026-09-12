import { Search, X, SlidersHorizontal } from 'lucide-react'
import {
  ALL_CATEGORIES,
  ALL_WARRANTIES,
  SORT_OPTIONS,
  WARRANTY_OPTIONS,
  type PurchaseFilters,
  type PurchaseSort,
} from './purchase-filters.ts'

export interface PurchasesToolbarProps {
  /** Estado atual dos controles (controlado pelo pai). */
  filters: PurchaseFilters
  /** Categorias derivadas das compras carregadas. */
  categories: string[]
  /** Atualiza um controle; nenhuma chamada de API é feita aqui. */
  onChange: (patch: Partial<PurchaseFilters>) => void
  /** `true` quando há busca/filtro ativo (habilita "Limpar filtros"). */
  hasActiveFilters: boolean
  /** Restaura o estado padrão (busca vazia, Todas, ordenação padrão). */
  onClear: () => void
}

const SELECT_CLASS =
  'w-full cursor-pointer rounded-lg border-slate-300 bg-white py-2.5 pr-8 pl-3 text-sm text-slate-900 focus:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40'

/**
 * Barra de busca, filtros e ordenação da página "Minhas compras".
 *
 * Componente controlado e "burro": só reflete e reporta o estado, sem chamar a
 * API. Os dados já estão em memória, então filtrar/ordenar é local.
 *
 * O controle "Garantia" filtra pelo status derivado do campo `warranty` que o
 * próprio `GET /purchases` já devolve — nenhuma opção aqui dispara requisição.
 */
export function PurchasesToolbar({
  filters,
  categories,
  onChange,
  hasActiveFilters,
  onClear,
}: PurchasesToolbarProps) {
  return (
    <section
      aria-label="Busca e filtros de compras"
      className="rounded-xl border-slate-200 bg-white p-4 sm:p-5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        {/* Busca — ocupa a maior parte da largura no desktop. */}
        <div className="min-w-0 flex-1">
          <label
            htmlFor="purchases-search"
            className="mb-1.5 block text-xs font-medium tracking-wide text-slate-500 uppercase"
          >
            Buscar
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="purchases-search"
              name="purchases-search"
              type="search"
              value={filters.query}
              onChange={(event) => onChange({ query: event.target.value })}
              placeholder="Buscar por produto, marca ou loja..."
              autoComplete="off"
              /* Esconde o "x" nativo do input[type=search], que duplicaria o
                 botão de limpar próprio abaixo (e o Firefox não suporta a
                 pseudo-classe, por isso também usamos type="text"-like reset). */
              className="w-full rounded-lg border-slate-300 bg-white py-2.5 pr-9 pl-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
            />
            {filters.query !== '' && (
              <button
                type="button"
                onClick={() => onChange({ query: '' })}
                aria-label="Limpar busca"
                className="absolute top-1/2 right-2 inline-flex h-6 w-6 -translate-y-1/2 cursor-pointer items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Filtros — empilham no mobile, ficam ao lado no desktop. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:shrink-0 lg:gap-3">
          <div className="min-w-0 lg:w-44">
            <label
              htmlFor="purchases-category"
              className="mb-1.5 block text-xs font-medium tracking-wide text-slate-500 uppercase"
            >
              Categoria
            </label>
            <select
              id="purchases-category"
              name="purchases-category"
              value={filters.category}
              onChange={(event) => onChange({ category: event.target.value })}
              className={SELECT_CLASS}
            >
              <option value={ALL_CATEGORIES}>Todas</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0 lg:w-48">
            <label
              htmlFor="purchases-warranty"
              className="mb-1.5 block text-xs font-medium tracking-wide text-slate-500 uppercase"
            >
              Garantia
            </label>
            <select
              id="purchases-warranty"
              name="purchases-warranty"
              value={filters.warranty}
              onChange={(event) => onChange({ warranty: event.target.value })}
              className={SELECT_CLASS}
            >
              <option value={ALL_WARRANTIES}>Todas</option>
              {WARRANTY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0 lg:w-44">
            <label
              htmlFor="purchases-sort"
              className="mb-1.5 block text-xs font-medium tracking-wide text-slate-500 uppercase"
            >
              Ordenar
            </label>
            <select
              id="purchases-sort"
              name="purchases-sort"
              value={filters.sort}
              onChange={(event) => onChange({ sort: event.target.value as PurchaseSort })}
              className={SELECT_CLASS}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {hasActiveFilters && (
        <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Limpar filtros</span>
          </button>
        </div>
      )}
    </section>
  )
}
