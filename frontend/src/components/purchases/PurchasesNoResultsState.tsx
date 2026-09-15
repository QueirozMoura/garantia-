import { SearchX, RotateCcw } from 'lucide-react'

export interface PurchasesNoResultsStateProps {
  /** Restaura busca/filtros/ordenação para o padrão (somente estado local). */
  onClear: () => void
}

/**
 * Estado exibido quando EXISTEM compras cadastradas, mas nenhuma corresponde à
 * busca/filtros ativos. É distinto do `PurchasesEmptyState` (nenhuma compra),
 * para o usuário entender que o problema é o filtro — não a ausência de dados.
 */
export function PurchasesNoResultsState({ onClear }: PurchasesNoResultsStateProps) {
  return (
    <div className="relative isolate overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-[0_18px_44px_-34px_rgb(15_23_42/0.5)] sm:p-12">
      <div className="surface-grid absolute inset-0 -z-10 opacity-25 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
        <SearchX className="h-6 w-6" aria-hidden="true" />
      </div>

      <h3 className="mt-4 text-base font-semibold text-slate-900 sm:text-lg">
        Nenhuma compra encontrada
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        Tente buscar por outro produto, marca ou loja, ou remova algum filtro.
      </p>

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={onClear}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.98]"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          <span>Limpar filtros</span>
        </button>
      </div>
    </div>
  )
}
