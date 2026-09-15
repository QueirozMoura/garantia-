import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  ShoppingBag,
  Trash2,
  Receipt,
  ShieldCheck,
  File,
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
import { Button } from '../ui/Button.tsx'

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
    const viewer = window.open('', '_blank')
    let objectUrl: string | null = null
    try {
      const blob = await getDocumentFile(document.id)
      objectUrl = URL.createObjectURL(blob)
      if (viewer) {
        viewer.location.href = objectUrl
      } else {
        window.open(objectUrl, '_blank', 'noopener,noreferrer')
      }
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

  let TypeIcon = File
  let typeColor = 'bg-slate-100 text-slate-600'

  if (document.type === 'INVOICE') {
    TypeIcon = FileText
    typeColor = 'bg-emerald-100 text-emerald-600'
  } else if (document.type === 'RECEIPT') {
    TypeIcon = Receipt
    typeColor = 'bg-blue-100 text-blue-600'
  } else if (document.type === 'WARRANTY') {
    TypeIcon = ShieldCheck
    typeColor = 'bg-amber-100 text-amber-600'
  } else if (document.type === 'OTHER') {
    TypeIcon = isImage ? ImageIcon : File
    typeColor = 'bg-slate-100 text-slate-600'
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 transition-all duration-200 hover:-translate-y-px hover:shadow-md hover:border-slate-300 sm:p-6">
      {/* Cabeçalho: ícone + nome + tipo + dados do arquivo */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${typeColor}`}
          >
            <TypeIcon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-900">
              {document.name}
            </h3>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
              <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700 ring-1 ring-slate-600/10">
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
      <div className="mt-4 flex min-w-0 items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3.5 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200 shadow-sm">
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
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          {actionError}
        </p>
      )}

      {/* Ações */}
      <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <Button variant="ghost" asChild>
          <Link to={`/purchases/${purchase.id}`}>Ver compra</Link>
        </Button>

        <Button
          variant="secondary"
          onClick={handleView}
          disabled={isViewing}
          leftIcon={isViewing ? <Loader2 className="animate-spin" /> : <Eye />}
        >
          {isViewing ? 'Abrindo...' : 'Visualizar'}
        </Button>

        <Button
          variant="danger"
          onClick={handleDelete}
          disabled={isDeleting}
          aria-label={`Excluir documento ${document.name}`}
          leftIcon={isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
        >
          {isDeleting ? 'Excluindo...' : 'Excluir'}
        </Button>
      </div>
    </article>
  )
}
