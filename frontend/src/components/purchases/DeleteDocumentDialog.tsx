import { useEffect, useRef } from 'react'
import { AlertCircle, Loader2, Trash2, X } from 'lucide-react'
import type { Document, DocumentType } from '../../types/document.ts'

/** Rótulos em português por tipo de documento (mesmos usados na listagem). */
const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  INVOICE: 'Nota fiscal',
  RECEIPT: 'Recibo',
  WARRANTY: 'Garantia',
  OTHER: 'Outro',
}

export interface DeleteDocumentDialogProps {
  /** Documento que será excluído (usado para identificação na confirmação). */
  document: Document
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
 * Confirmação visual para excluir um documento.
 *
 * Nada é enviado ao abrir: só o clique explícito em "Excluir documento" dispara o
 * DELETE. Cancelar, o X, Escape ou clique fora apenas fecham (e são bloqueados
 * durante a exclusão). Espelha o DeleteWarrantyDialog para manter a mesma UX.
 */
export function DeleteDocumentDialog({
  document,
  onClose,
  onConfirm,
  isDeleting = false,
  errorMessage = null,
}: DeleteDocumentDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)

  // Escape fecha (exceto durante a exclusão) e o foco vai para o botão seguro.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeleting) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    cancelRef.current?.focus()
    // `window.document` explícito: a prop `document` (o documento a excluir)
    // teria o mesmo nome do objeto global `document`.
    const previousOverflow = window.document.body.style.overflow
    window.document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.document.body.style.overflow = previousOverflow
    }
  }, [onClose, isDeleting])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-document-title"
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
              <Trash2 className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h3
                id="delete-document-title"
                className="text-base font-semibold text-slate-900 sm:text-lg"
              >
                Excluir documento?
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                Tem certeza que deseja excluir este documento? Essa ação não pode ser
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

        {/* Identificação do documento */}
        <dl className="space-y-3 p-5 sm:p-6">
          <div className="min-w-0">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Documento
            </dt>
            <dd className="mt-0.5 truncate text-sm text-slate-900">{document.name}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Tipo
            </dt>
            <dd className="mt-0.5 truncate text-sm text-slate-900">
              {DOCUMENT_TYPE_LABELS[document.type] ?? DOCUMENT_TYPE_LABELS.OTHER}
            </dd>
          </div>
        </dl>

        {/* Erro da exclusão (mantém o modal aberto para tentar de novo). */}
        {errorMessage && (
          <div
            role="alert"
            className="mx-5 flex items-start gap-2.5 rounded-lg border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 sm:mx-6"
          >
            <AlertCircle className="h-4 w-4 shrink-0 translate-y-0.5" aria-hidden="true" />
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
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                <span>Excluir documento</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
