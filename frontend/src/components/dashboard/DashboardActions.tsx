import { Plus, FileUp } from 'lucide-react'

export function DashboardActions() {
  return (
    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
      {/* Botão Secundário / Importar XML */}
      <button
        type="button"
        className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm"
      >
        <FileUp className="h-4 w-4 text-slate-500" aria-hidden="true" />
        <span>Importar XML / NF-e</span>
      </button>

      {/* Botão Primário / Adicionar compra */}
      <button
        type="button"
        className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        <span>Adicionar compra</span>
      </button>
    </div>
  )
}
