import { Search, X, SlidersHorizontal } from 'lucide-react'
import {
  ALL_WARRANTY_STATUSES,
  SORT_OPTIONS,
  WARRANTY_STATUS_OPTIONS,
  type WarrantyFilters,
  type WarrantySort,
} from './warranty-filters.ts'

export interface WarrantiesToolbarProps {
  /** Estado atual dos controles (controlado pelo pai). */
  filters: WarrantyFilters
  /** Atualiza um controle; nenhuma chamada de API é feita aqui. */
  onChange: (patch: Partial<WarrantyFilters>) => void
  /** `true` quando há busca/filtro ativo (habilita "Limpar filtros"). */
  hasActiveFilters: boolean
  /** Restaura o estado padrão (busca vazia, Todos, ordenação padrão). */
  onClear: () => void
}

const SELECT_CLASS =
  'w-full cursor-pointer rounded-xl border-slate-200 bg-slate-50/70 py-3 pr-8 pl-3 text-sm text-slate-800 transition-all duration-200 hover:border-slate-300 hover:bg-white focus:border-emerald-500 focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25'

/**
 * Barra de busca, filtro por status e ordenação da página "Garantias".
 *
 * Componente controlado e "burro": só reflete e reporta o estado, sem chamar a
 * API. Os dados já estão em memória, então filtrar/ordenar é local. As opções de
 * status vêm do helper central (`lib/warranty-status.ts`) e a ordenação usa
 * `endDate` — nenhuma opção aqui dispara requisição.
 *
 * Mesmo padrão visual e estrutural de `DocumentsToolbar`/`PurchasesToolbar`.
 */
export function WarrantiesToolbar({
  filters,
  onChange,
  hasActiveFilters,
  onClear,
}: WarrantiesToolbarProps) {
  return (
    <section
      aria-label="Busca e filtros de garantias"
      className="rounded-[1.5rem] border-slate-200 bg-white p-4 shadow-[0_16px_38px_-32px_rgb(15_23_42/0.5)] sm:p-5"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        {/* Busca — ocupa a maior parte da largura no desktop. */}
        <div className="min-w-0 flex-1">
          <label
            htmlFor="warranties-search"
            className="mb-2 block text-[10px] font-bold tracking-[0.16em] text-slate-400 uppercase"
          >
            Buscar
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="warranties-search"
              name="warranties-search"
              type="search"
              value={filters.query}
              onChange={(event) => onChange({ query: event.target.value })}
              placeholder="Buscar por produto ou marca..."
              autoComplete="off"
              /* Esconde o "x" nativo do input[type=search], que duplicaria o
                 botão de limpar próprio abaixo (e o Firefox não suporta a
                 pseudo-classe, por isso também usamos type="search"). */
              className="w-full rounded-xl border-slate-200 bg-slate-50/70 py-3 pr-10 pl-10 text-sm text-slate-900 transition-all duration-200 placeholder:text-slate-400 hover:border-slate-300 hover:bg-white focus:border-emerald-500 focus:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25 [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
            />
            {filters.query !== '' && (
              <button
                type="button"
                onClick={() => onChange({ query: '' })}
                aria-label="Limpar busca"
                className="absolute top-1/2 right-2 inline-flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-slate-400 transition-all duration-200 hover:bg-slate-200/70 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        </div>

        {/* Filtros — empilham no mobile, ficam ao lado no desktop. */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:flex lg:shrink-0 lg:gap-3">
          <div className="min-w-0 lg:w-48">
            <label
              htmlFor="warranties-status"
              className="mb-2 block text-[10px] font-bold tracking-[0.16em] text-slate-400 uppercase"
            >
              Status
            </label>
            <select
              id="warranties-status"
              name="warranties-status"
              value={filters.status}
              onChange={(event) => onChange({ status: event.target.value })}
              className={SELECT_CLASS}
            >
              <option value={ALL_WARRANTY_STATUSES}>Todos</option>
              {WARRANTY_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="min-w-0 lg:w-52">
            <label
              htmlFor="warranties-sort"
              className="mb-2 block text-[10px] font-bold tracking-[0.16em] text-slate-400 uppercase"
            >
              Ordenar
            </label>
            <select
              id="warranties-sort"
              name="warranties-sort"
              value={filters.sort}
              onChange={(event) => onChange({ sort: event.target.value as WarrantySort })}
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
        <div className="mt-4 flex justify-start border-t border-slate-100 pt-3">
          <button
            type="button"
            onClick={onClear}
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-xl border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-all duration-200 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Limpar filtros</span>
          </button>
        </div>
      )}
    </section>
  )
}
