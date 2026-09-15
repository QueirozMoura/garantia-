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
        className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[0.08] px-3.5 py-2.5 text-xs font-semibold text-white transition-all duration-200 hover:border-white/25 hover:bg-white/[0.14] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 active:scale-[0.98] sm:text-sm"
      >
        <FileUp className="h-4 w-4 text-emerald-300" aria-hidden="true" />
        <span>Importar XML / NF-e</span>
      </button>

      {/* Botão Primário / Adicionar compra — vai para o fluxo real de criação. */}
      <button
        type="button"
        onClick={() => navigate('/purchases/new')}
        className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-500 px-3.5 py-2.5 text-xs font-semibold text-white shadow-[0_10px_22px_-14px_rgb(16_185_129/0.9)] transition-all duration-200 hover:bg-emerald-400 hover:shadow-[0_14px_26px_-14px_rgb(16_185_129/0.9)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300 active:scale-[0.98] sm:text-sm"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        <span>Adicionar compra</span>
      </button>
    </div>
  )
}
