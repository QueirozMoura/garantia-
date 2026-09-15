import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Eye,
  File,
  FileCode2,
  FileText,
  Image as ImageIcon,
  Loader2,
  Receipt,
  ShieldCheck,
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
import type { DocumentType, DocumentWithPurchase } from '../../types/document.ts'
import { documentTypeLabel, formatFileSize } from './document-presentation.ts'
import { Button } from '../ui/Button.tsx'

const FALLBACK_DELETE_ERROR = 'Não foi possível excluir o documento.'
const FALLBACK_VIEW_ERROR = 'Não foi possível abrir o documento.'

export interface DocumentCardProps {
  document: DocumentWithPurchase
  onDeleted: (documentId: string) => void
  onAuthError: () => void
}

const TYPE_CONFIG: Record<
  DocumentType,
  { icon: typeof FileText; surface: string; iconText: string; marker: string }
> = {
  INVOICE: {
    icon: FileText,
    surface: 'bg-emerald-50',
    iconText: 'text-emerald-700',
    marker: 'bg-emerald-500',
  },
  RECEIPT: {
    icon: Receipt,
    surface: 'bg-blue-50',
    iconText: 'text-blue-700',
    marker: 'bg-blue-500',
  },
  WARRANTY: {
    icon: ShieldCheck,
    surface: 'bg-amber-50',
    iconText: 'text-amber-700',
    marker: 'bg-amber-500',
  },
  OTHER: {
    icon: File,
    surface: 'bg-slate-100',
    iconText: 'text-slate-600',
    marker: 'bg-slate-400',
  },
}

export function DocumentCard({ document, onDeleted, onAuthError }: DocumentCardProps) {
  const [isViewing, setIsViewing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  const { purchase } = document
  const isImage = document.mimeType.startsWith('image/')
  const brandModel = [purchase.brand, purchase.model].filter(Boolean).join(' ')
  const config = TYPE_CONFIG[document.type]
  const TypeIcon = document.type === 'OTHER' && isImage ? ImageIcon : config.icon

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

  return (
    <article className="group relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_14px_34px_-30px_rgb(15_23_42/0.65)] transition-all duration-200 hover:-translate-y-1 hover:border-blue-200 hover:bg-blue-50/[0.12] hover:shadow-[0_22px_42px_-28px_rgb(15_23_42/0.55)] sm:p-6">
      <div className={`absolute inset-x-0 top-0 h-0.5 ${config.marker} opacity-70`} />
      <div className="flex items-start gap-4">
        <div
          className={`relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${config.surface} ${config.iconText} transition-transform duration-200 group-hover:rotate-[-3deg] group-hover:scale-105`}
        >
          <TypeIcon className="h-6 w-6" aria-hidden="true" />
          <span className="absolute -bottom-1 -right-1 rounded-md border-2 border-white bg-slate-900 px-1 py-0.5 text-[8px] font-bold text-white uppercase">
            {isImage ? 'IMG' : document.mimeType.split('/')[1]?.slice(0, 4) || 'DOC'}
          </span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="mb-1 text-[10px] font-bold tracking-[0.16em] text-slate-400 uppercase">
                Documento protegido
              </p>
              <h3 className="truncate text-base font-semibold tracking-[-0.015em] text-slate-950 transition-colors duration-200 group-hover:text-blue-800">
                {document.name}
              </h3>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700 ring-1 ring-slate-900/5">
                  {documentTypeLabel(document.type)}
                </span>
                <span>{formatFileSize(document.size)}</span>
                <span className="text-slate-300" aria-hidden="true">
                  •
                </span>
                <span>Adicionado em {formatDateBR(document.createdAt)}</span>
              </div>
            </div>
            <FileCode2
              className="h-4 w-4 shrink-0 text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-blue-600"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>

      <div className="mt-5 flex min-w-0 items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 px-4 py-3.5 transition-colors duration-200 group-hover:border-blue-100 group-hover:bg-white">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-xs ring-1 ring-slate-200">
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase">
            Compra relacionada
          </p>
          <p className="mt-1 truncate text-sm font-medium text-slate-900">
            {purchase.productName}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {brandModel || purchase.store || 'Detalhes da compra'}
          </p>
        </div>
      </div>

      {actionError && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700"
        >
          {actionError}
        </p>
      )}

      <div className="mt-5 flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
        <Button variant="ghost" asChild>
          <Link to={`/purchases/${purchase.id}`} className="group/action">
            Ver compra
            <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-200 group-hover/action:translate-x-0.5" />
          </Link>
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
