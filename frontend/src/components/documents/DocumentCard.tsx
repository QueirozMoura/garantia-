import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  ShoppingBag,
  Trash2,
} from 'lucide-react'
import {
  AuthenticationError,
  ApiError,
  deleteDocument,
  getDocumentFile,
} from '../../lib/api.ts'
import { formatDateBR } from '../../lib/formatters.ts'
import type { DocumentWithPurchase } from '../../types/document.ts'
import { documentTypeLabel, formatFileSize } from './document-presentation.ts'

const FALLBACK_DELETE_ERROR = 'Não foi possível excluir o documento.'
const FALLBACK_VIEW_ERROR = 'Não foi possível abrir o documento.'

export interface DocumentCardProps {
  document: DocumentWithPurchase
  onDeleted: (documentId: string) => void
  onAuthError: () => void
}

export function DocumentCard({ document, onDeleted, onAuthError }: DocumentCardProps) {
  const [isViewing, setIsViewing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const { purchase } = document
  const isImage = document.mimeType.startsWith('image/')
  const brandModel = [purchase.brand, purchase.model].filter(Boolean).join(' ')

  const handleView = async () => {
    if (isViewing) return
    setIsViewing(true)
    setActionError(null)
    // Abre a aba no clique (sincronamente) para não ser bloqueada por popup
    // blockers; o Blob é atribuído depois que a requisição resolve.
    const viewer = window.open('', '_blank')
    let objectUrl: string | null = null
    try {
      // O arquivo é privado: busca autenticada via fetch (token no header),
      // depois abre o Blob em memória. Nenhuma URL pública/token na URL.
      const blob = await getDocumentFile(document.id)
      objectUrl = URL.createObjectURL(blob)
      if (viewer) {
        viewer.location.href = objectUrl
      } else {
        window.open(objectUrl, '_blank', 'noopener,noreferrer')
      }
      // Libera o Blob depois que a aba tiver chance de carregá-lo.
      window.setTimeout(() => URL.revokeObjectURL(objectUrl as string), 60_000)
    } catch (error) {
      viewer?.close()
      if (error instanceof AuthenticationError) {
        onAuthError()
        return
      }
      setActionError(error instanceof ApiError ? error.message : FALLBACK_VIEW_ERROR)
    } finally {
      setIsViewing(false)
    }
  }

  const handleDelete = async () => {
    if (isDeleting) return
    const confirmed = window.confirm(
      `Excluir o documento "${document.name}"? Esta ação não pode ser desfeita.`,
    )
    if (!confirmed) return

    setIsDeleting(true)
    setActionError(null)
    try {
      await deleteDocument(document.id)
      onDeleted(document.id)
    } catch (error) {
      if (error instanceof AuthenticationError) {
        onAuthError()
        return
      }
      setActionError(error instanceof ApiError ? error.message : FALLBACK_DELETE_ERROR)
      setIsDeleting(false)
    }
  }

  return (
    <article className="rounded-xl border-slate-200 bg-white p-5 transition-colors hover:border-slate-300 sm:p-6">
      {/* Cabeçalho: ícone + nome + tipo + dados do arquivo */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            {isImage ? (
              <ImageIcon className="h-5 w-5" aria-hidden="true" />
            ) : (
              <FileText className="h-5 w-5" aria-hidden="true" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-900">
              {document.name}
            </h3>
            <p className="mt-0.5 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 ring-1 ring-emerald-600/20">
                {documentTypeLabel(document.type)}
              </span>
              <span>{formatFileSize(document.size)}</span>
              <span className="text-slate-300" aria-hidden="true">
                •
              </span>
              <span>Adicionado em {formatDateBR(document.createdAt)}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Compra relacionada */}
      <div className="mt-4 flex min-w-0 items-center gap-3 rounded-lg border-slate-100 bg-slate-50/60 px-3.5 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200">
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">
            {purchase.productName}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {brandModel || purchase.store || '-'}
          </p>
        </div>
      </div>

      {actionError && (
        <p
          role="alert"
          className="mt-4 rounded-lg border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          {actionError}
        </p>
      )}

      {/* Ações */}
      <div className="mt-5 flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <Link
          to={`/purchases/${purchase.id}`}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm"
        >
          <span>Ver compra</span>
        </Link>

        <button
          type="button"
          onClick={handleView}
          disabled={isViewing}
          className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
        >
          {isViewing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>{isViewing ? 'Abrindo...' : 'Visualizar'}</span>
        </button>

        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          aria-label={`Excluir documento ${document.name}`}
          className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 shadow-xs transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
        >
          {isDeleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>{isDeleting ? 'Excluindo...' : 'Excluir'}</span>
        </button>
      </div>
    </article>
  )
}
