import { Plus, FileUp } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

export interface DashboardActionsProps {
  /** Abre o aviso de funcionalidade em desenvolvimento da importação de XML/NF-e. */
  onImportXml: () => void
}

export function DashboardActions({ onImportXml }: DashboardActionsProps) {
  const navigate = useNavigate()

  return (
    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
      {/* Importar XML / NF-e: importador ainda não implementado. O clique apenas
          abre o aviso de "em breve" (o modal é compartilhado com o empty state). */}
      <button
        type="button"
        onClick={onImportXml}
        className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm"
      >
        <FileUp className="h-4 w-4 text-emerald-600" aria-hidden="true" />
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
