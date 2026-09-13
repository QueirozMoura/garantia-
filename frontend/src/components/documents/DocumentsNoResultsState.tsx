import { SearchX, RotateCcw } from 'lucide-react'

export interface DocumentsNoResultsStateProps {
  /** Restaura busca/filtros/ordenação para o padrão (somente estado local). */
  onClear: () => void
}

/**
 * Estado exibido quando EXISTEM documentos carregados, mas nenhum corresponde à
 * busca/filtros ativos. É distinto do `DocumentsEmptyState` (nenhum documento),
 * para o usuário entender que o problema é o filtro — não a ausência de dados.
 */
export function DocumentsNoResultsState({ onClear }: DocumentsNoResultsStateProps) {
  return (
    <div className="rounded-2xl border-dashed border-slate-300 bg-white p-8 text-center sm:p-12">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
        <SearchX className="h-6 w-6" aria-hidden="true" />
      </div>

      <h3 className="mt-4 text-base font-semibold text-slate-900 sm:text-lg">
        Nenhum documento encontrado
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        Nenhum documento corresponde aos filtros selecionados. Tente ajustar sua busca ou
        remover algum filtro.
      </p>

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={onClear}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          <span>Limpar filtros</span>
        </button>
      </div>
    </div>
  )
}
