import { ShoppingBag, Plus, FileUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export interface DashboardEmptyStateProps {
  /** Abre o aviso de funcionalidade em desenvolvimento da importação de XML/NF-e. */
  onImportXml: () => void
}

export function DashboardEmptyState({ onImportXml }: DashboardEmptyStateProps) {
  const navigate = useNavigate()

  return (
    <div className="relative isolate overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-[0_18px_44px_-34px_rgb(15_23_42/0.5)] sm:p-14">
      <div className="surface-grid absolute inset-0 -z-10 opacity-35 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
        <ShoppingBag className="h-6 w-6" aria-hidden="true" />
      </div>

      <h3 className="mt-4 text-base font-semibold text-slate-900 sm:text-lg">
        Nenhuma compra cadastrada ainda
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        Comece adicionando seu primeiro produto ou importe um arquivo XML de nota fiscal
        para acompanhar prazos de garantia e documentos automaticamente.
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onImportXml}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition-all duration-200 hover:border-emerald-200 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          <FileUp className="h-4 w-4 text-emerald-600" aria-hidden="true" />
          <span>Importar XML / NF-e</span>
        </button>

        <button
          type="button"
          onClick={() => navigate('/purchases/new')}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-all duration-200 hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Adicionar compra</span>
        </button>
      </div>
    </div>
  )
}
