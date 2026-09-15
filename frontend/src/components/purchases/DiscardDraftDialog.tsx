import { useEffect, useRef } from 'react'
import { History, Loader2, X } from 'lucide-react'

export interface DiscardDraftDialogProps {
  /** Fecha o diálogo sem descartar. Ignorado enquanto `isDiscarding`. */
  onClose: () => void
  /** Confirma o descarte (limpa o rascunho e o formulário). */
  onConfirm: () => void
  /** `true` enquanto o descarte está sendo processado. */
  isDiscarding?: boolean
}

/**
 * Confirmação leve para descartar o rascunho de compra. Espelha o padrão dos
 * diálogos de exclusão existentes (Escape fecha, foco no botão seguro, clique
 * fora fecha). Nenhuma API é chamada — só limpa o rascunho local.
 */
export function DiscardDraftDialog({
  onClose,
  onConfirm,
  isDiscarding = false,
}: DiscardDraftDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDiscarding) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    cancelRef.current?.focus()
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose, isDiscarding])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-draft-title"
      onClick={() => {
        if (!isDiscarding) onClose()
      }}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5 sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <History className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3
                id="discard-draft-title"
                className="text-base font-semibold text-slate-900 sm:text-lg"
              >
                Descartar compra iniciada?
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Os dados preenchidos como visitante serão removidos. Essa ação não pode
                ser desfeita.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDiscarding}
            aria-label="Fechar"
            className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border-slate-300 bg-white p-2 text-slate-500 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 flex-col-reverse gap-3 border-t border-slate-100 p-5 sm:flex-row sm:justify-end sm:p-6">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={isDiscarding}
            className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDiscarding}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-amber-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isDiscarding ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Descartando...</span>
              </>
            ) : (
              <span>Descartar</span>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
