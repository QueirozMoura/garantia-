import { useEffect, useRef } from 'react'
import { AlertCircle, Loader2, ShieldX, X } from 'lucide-react'
import { formatDateBR } from '../../lib/formatters.ts'
import type { Warranty } from '../../types/warranty.ts'

export interface DeleteWarrantyDialogProps {
  /** Garantia que será excluída (usada para identificação na confirmação). */
  warranty: Warranty
  /** Fecha o modal sem excluir. Ignorado enquanto `isDeleting`. */
  onClose: () => void
  /** Executa a exclusão (DELETE). Ignorado enquanto `isDeleting`. */
  onConfirm: () => void
  /** `true` enquanto o DELETE está em andamento. */
  isDeleting?: boolean
  /** Mensagem de erro amigável exibida quando a exclusão falha. */
  errorMessage?: string | null
}

/**
 * Confirmação visual para excluir uma garantia.
 *
 * Nada é enviado ao abrir: só o clique explícito em "Excluir garantia" dispara o
 * DELETE. Cancelar, o X, Escape ou clique fora apenas fecham (e são bloqueados
 * durante a exclusão). Espelha o DeletePurchaseDialog para manter a mesma UX.
 */
export function DeleteWarrantyDialog({
  warranty,
  onClose,
  onConfirm,
  isDeleting = false,
  errorMessage = null,
}: DeleteWarrantyDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Escape fecha (exceto durante a exclusão) e o foco vai para o botão seguro.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeleting) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    cancelRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose, isDeleting])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-warranty-title"
      onClick={() => {
        if (!isDeleting) onClose()
      }}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5 sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-red-50 text-red-600">
              <ShieldX className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3
                id="delete-warranty-title"
                className="text-base font-semibold text-slate-900 sm:text-lg"
              >
                Excluir garantia?
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Tem certeza que deseja excluir esta garantia? Essa ação não pode ser
                desfeita.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Fechar"
            className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border-slate-300 bg-white p-2 text-slate-500 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Identificação da garantia */}
        <dl className="space-y-3 p-5 sm:p-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                Duração
              </dt>
              <dd className="mt-0.5 truncate text-sm text-slate-900">
                {warranty.durationMonths} meses
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                Início
              </dt>
              <dd className="mt-0.5 truncate text-sm text-slate-900">
                {formatDateBR(warranty.startDate)}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                Término
              </dt>
              <dd className="mt-0.5 truncate text-sm text-slate-900">
                {formatDateBR(warranty.endDate)}
              </dd>
            </div>
          </div>
        </dl>

        {/* Erro da exclusão (mantém o modal aberto para tentar de novo). */}
        {errorMessage && (
          <div
            role="alert"
            className="mx-5 flex items-start gap-2.5 rounded-lg border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 sm:mx-6"
          >
            <AlertCircle
              className="h-4 w-4 shrink-0 translate-y-0.5"
              aria-hidden="true"
            />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Ações */}
        <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-100 p-5 sm:flex-row sm:justify-end sm:p-6">
          <button
            ref={cancelRef}
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Excluindo...</span>
              </>
            ) : (
              <>
                <ShieldX className="h-4 w-4" aria-hidden="true" />
                <span>Excluir garantia</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
