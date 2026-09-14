import { useEffect, useRef } from 'react'
import { FileUp, X } from 'lucide-react'
import { XML_IMPORT_COMING_SOON_MESSAGE } from './placeholder-actions.ts'

export interface XmlImportComingSoonDialogProps {
  /** Fecha o modal. */
  onClose: () => void
}

/**
 * Aviso de funcionalidade ainda em desenvolvimento para a importação de XML/NF-e.
 *
 * O importador não existe no projeto (sem página, rota ou endpoint): este modal
 * apenas informa o usuário, sem simular upload nem disparar nenhuma requisição.
 * Compartilhado pelo botão do header da Dashboard e pelo empty state — uma única
 * implementação para os dois pontos de entrada.
 *
 * Espelha a UX dos demais dialogs do projeto: Escape e clique fora fecham, o foco
 * vai para o botão seguro ("Entendi"), o scroll do body é travado enquanto aberto
 * e o layout é responsivo (bottom sheet no mobile, centralizado no desktop).
 */
export function XmlImportComingSoonDialog({ onClose }: XmlImportComingSoonDialogProps) {
  const dismissRef = useRef<HTMLButtonElement>(null)

  // Escape fecha e o foco vai para o botão "Entendi".
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    dismissRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="xml-import-coming-soon-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5 sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <FileUp className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3
                id="xml-import-coming-soon-title"
                className="text-base font-semibold text-slate-900 sm:text-lg"
              >
                Importação de XML / NF-e
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {XML_IMPORT_COMING_SOON_MESSAGE}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border-slate-300 bg-white p-2 text-slate-500 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Ações */}
        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 p-5 sm:flex-row sm:justify-end sm:p-6">
          <button
            ref={dismissRef}
            type="button"
            onClick={onClose}
            className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:w-auto"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}
