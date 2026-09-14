import { ShoppingBag, Plus, FileUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { XML_IMPORT_UNAVAILABLE_HINT } from './placeholder-actions.ts'

export function DashboardEmptyState() {
  const navigate = useNavigate()

  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center sm:p-12">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
        <ShoppingBag className="h-6 w-6" aria-hidden="true" />
      </div>

      <h3 className="mt-4 text-base font-semibold text-slate-900 sm:text-lg">
        Nenhuma compra cadastrada ainda
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        Comece adicionando seu primeiro produto ou importe um arquivo XML de nota fiscal
        para acompanhar prazos de garantia e documentos automaticamente.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          disabled
          aria-disabled="true"
          title={XML_IMPORT_UNAVAILABLE_HINT}
          className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-400 shadow-xs"
        >
          <FileUp className="h-4 w-4 text-slate-400" aria-hidden="true" />
          <span>Importar XML / NF-e</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/purchases/new')}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Adicionar compra</span>
        </button>
      </div>
    </div>
  )
}
