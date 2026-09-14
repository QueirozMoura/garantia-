import { Plus, FileUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { XML_IMPORT_UNAVAILABLE_HINT } from './placeholder-actions.ts'

export function DashboardActions() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
      {/* Importar XML / NF-e: funcionalidade ainda não implementada no projeto.
          Permanece visível, mas explicitamente NÃO interativo. */}
      <button
        type="button"
        disabled
        aria-disabled="true"
        title={XML_IMPORT_UNAVAILABLE_HINT}
        className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-lg border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-400 shadow-xs sm:text-sm"
      >
        <FileUp className="h-4 w-4 text-slate-400" aria-hidden="true" />
        <span>Importar XML / NF-e</span>
      </button>

      {/* Botão Primário / Adicionar compra — vai para o fluxo real de criação. */}
      <button
        type="button"
        onClick={() => navigate('/purchases/new')}
        className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        <span>Adicionar compra</span>
      </button>
    </div>
  )
}
