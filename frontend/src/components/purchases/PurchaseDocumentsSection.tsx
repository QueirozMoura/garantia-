import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  Eye,
  FileText,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  getPurchaseDocuments,
  uploadPurchaseDocument,
  deleteDocument,
  getDocumentFile,
  extractDocument,
  confirmDocumentExtraction,
  AuthenticationError,
  ApiError,
} from '../../lib/api.ts'
import { useAuth } from '../../contexts/auth-context.ts'
import { formatDateBR } from '../../lib/formatters.ts'
import type {
  Document,
  DocumentExtraction,
  DocumentExtractionConfirmationResponse,
  DocumentType,
} from '../../types/document.ts'
import { DocumentExtractionPanel } from './DocumentExtractionPanel.tsx'
import {
  extractFriendlyMessage,
  formatFileSize,
  validateDocumentFile,
} from './purchase-document.ts'

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; documents: Document[] }

const FALLBACK_ERROR = 'Não foi possível carregar os documentos.'
const FALLBACK_UPLOAD_ERROR = 'Não foi possível enviar o documento.'
const FALLBACK_DELETE_ERROR = 'Não foi possível excluir o documento.'
const FALLBACK_VIEW_ERROR = 'Não foi possível abrir o documento.'
const FALLBACK_CONFIRM_ERROR = 'Não foi possível aplicar os dados. Tente novamente.'

/** Traduz um erro da extração em uma mensagem amigável (sem detalhes internos). */
const extractErrorMessage = (error: unknown) =>
  extractFriendlyMessage(error instanceof ApiError ? error : null)

/**
 * Traduz um erro da confirmação em uma mensagem amigável por status HTTP.
 * Nunca expõe detalhes internos/stack.
 */
const confirmErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 400) {
      return 'Os dados extraídos não puderam ser aplicados. Verifique as informações e tente novamente.'
    }
    if (error.status === 403) {
      return 'Você não tem permissão para atualizar este documento.'
    }
    if (error.status === 404) {
      return 'Este documento não foi encontrado.'
    }
  }
  return FALLBACK_CONFIRM_ERROR
}

/** Rótulos em português por tipo de documento. */
const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  INVOICE: 'Nota fiscal',
  RECEIPT: 'Recibo',
  WARRANTY: 'Garantia',
  OTHER: 'Outro',
}

const DOCUMENT_TYPE_OPTIONS: DocumentType[] = ['INVOICE', 'RECEIPT', 'WARRANTY', 'OTHER']

export interface PurchaseDocumentsSectionProps {
  purchaseId: string
  /**
   * Chamado quando uma extração é confirmada com sucesso, com a compra e a
   * garantia já atualizadas retornadas pelo backend. Permite atualizar a tela
   * sem reload.
   */
  onPurchaseUpdated?: (result: DocumentExtractionConfirmationResponse) => void
}

export function PurchaseDocumentsSection({
  purchaseId,
  onPurchaseUpdated,
}: PurchaseDocumentsSectionProps) {
  const navigate = useNavigate()
  const { expireSession } = useAuth()
  const [state, setState] = useState<FetchState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [extractingId, setExtractingId] = useState<string | null>(null)
  // Extração aberta no painel, junto do documento de origem (para o PATCH).
  const [extraction, setExtraction] = useState<{
    documentId: string
    data: DocumentExtraction
  } | null>(null)
  const [isConfirming, setIsConfirming] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const handleAuthError = useCallback(() => {
    // Token inválido/expirado: consolida o estado visitante e volta ao login.
    expireSession()
    navigate('/login', { replace: true })
  }, [navigate, expireSession])

  useEffect(() => {
    let isActive = true
    const load = async () => {
      try {
        const documents = await getPurchaseDocuments(purchaseId)
        if (isActive) setState({ status: 'success', documents })
      } catch (error) {
        if (!isActive) return
        if (error instanceof AuthenticationError) {
          handleAuthError()
          return
        }
        const message = error instanceof ApiError ? error.message : FALLBACK_ERROR
        setState({ status: 'error', message })
      }
    }

    void load()

    return () => {
      isActive = false
    }
  }, [purchaseId, reloadKey, handleAuthError])

  const handleRetry = useCallback(() => {
    setActionError(null)
    setState({ status: 'loading' })
    setReloadKey((key) => key + 1)
  }, [])

  const handleCreated = useCallback((document: Document) => {
    setState((current) =>
      current.status === 'success'
        ? { status: 'success', documents: [document, ...current.documents] }
        : current,
    )
    setShowForm(false)
  }, [])

  const handleDelete = useCallback(
    async (document: Document) => {
      if (deletingId) return
      const confirmed = window.confirm(
        `Excluir o documento "${document.name}"? Esta ação não pode ser desfeita.`,
      )
      if (!confirmed) return

      setDeletingId(document.id)
      setActionError(null)
      try {
        await deleteDocument(document.id)
        setState((current) =>
          current.status === 'success'
            ? {
                status: 'success',
                documents: current.documents.filter((item) => item.id !== document.id),
              }
            : current,
        )
      } catch (error) {
        if (error instanceof AuthenticationError) {
          handleAuthError()
          return
        }
        setActionError(error instanceof ApiError ? error.message : FALLBACK_DELETE_ERROR)
      } finally {
        setDeletingId(null)
      }
    },
    [deletingId, handleAuthError],
  )

  const handleExtract = useCallback(
    async (document: Document) => {
      if (extractingId) return
      setExtractingId(document.id)
      setActionError(null)
      try {
        const data = await extractDocument(document.id)
        setConfirmError(null)
        setExtraction({ documentId: document.id, data })
      } catch (error) {
        if (error instanceof AuthenticationError) {
          handleAuthError()
          return
        }
        // 404: o documento não existe mais no backend. Mantém a mensagem
        // amigável e remove o item obsoleto da lista local para sincronizar a UI.
        if (error instanceof ApiError && error.status === 404) {
          setState((current) =>
            current.status === 'success'
              ? {
                  status: 'success',
                  documents: current.documents.filter((item) => item.id !== document.id),
                }
              : current,
          )
        }
        setActionError(extractErrorMessage(error))
      } finally {
        setExtractingId(null)
      }
    },
    [extractingId, handleAuthError],
  )

  const handleConfirm = useCallback(
    async (editedData: DocumentExtraction) => {
      if (!extraction || isConfirming) return
      setIsConfirming(true)
      setConfirmError(null)
      try {
        // Envia exatamente os dados revisados/editados pelo usuário.
        const result = await confirmDocumentExtraction(extraction.documentId, editedData)
        // Fecha o painel e propaga os dados atualizados para a página (sem F5).
        setExtraction(null)
        onPurchaseUpdated?.(result)
      } catch (error) {
        if (error instanceof AuthenticationError) {
          handleAuthError()
          return
        }
        // Mantém o painel aberto (com os valores editados pelo usuário) para
        // que ele possa corrigir e tentar de novo.
        setConfirmError(confirmErrorMessage(error))
      } finally {
        setIsConfirming(false)
      }
    },
    [extraction, isConfirming, onPurchaseUpdated, handleAuthError],
  )

  const documents = state.status === 'success' ? state.documents : []

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900">
              Cofre de documentos
            </h3>
            <p className="mt-0.5 text-sm text-slate-500">
              Notas, recibos e comprovantes desta compra.
            </p>
          </div>
        </div>
        {state.status === 'success' && documents.length > 0 && !showForm && (
          <button
            type="button"
            onClick={() => {
              setActionError(null)
              setShowForm(true)
            }}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span>Adicionar documento</span>
          </button>
        )}
      </div>

      {actionError && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2.5 rounded-lg border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0 translate-y-0.5" aria-hidden="true" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="mt-5">
        {state.status === 'loading' && <DocumentsSkeleton />}

        {state.status === 'error' && (
          <DocumentsErrorState message={state.message} onRetry={handleRetry} />
        )}

        {state.status === 'success' && showForm && (
          <div className="mb-5">
            <DocumentForm
              purchaseId={purchaseId}
              onCancel={() => setShowForm(false)}
              onCreated={handleCreated}
              onAuthError={handleAuthError}
            />
          </div>
        )}

        {state.status === 'success' && documents.length === 0 && !showForm && (
          <DocumentsEmptyState onAdd={() => setShowForm(true)} />
        )}

        {state.status === 'success' && documents.length > 0 && (
          <ul className="divide-y divide-slate-100">
            {documents.map((document) => (
              <DocumentItem
                key={document.id}
                document={document}
                isDeleting={deletingId === document.id}
                isBusy={deletingId !== null}
                isExtracting={extractingId === document.id}
                isExtractBusy={extractingId !== null}
                onDelete={handleDelete}
                onExtract={handleExtract}
                onAuthError={handleAuthError}
                onViewError={setActionError}
              />
            ))}
          </ul>
        )}
      </div>

      {extraction && (
        <DocumentExtractionPanel
          data={extraction.data}
          onClose={() => setExtraction(null)}
          onConfirm={handleConfirm}
          isSaving={isConfirming}
          confirmError={confirmError}
        />
      )}
    </section>
  )
}

/** Loading: skeleton consistente com os demais do projeto. */
function DocumentsSkeleton() {
  return (
    <div
      className="space-y-3 animate-pulse"
      aria-busy="true"
      aria-label="Carregando documentos"
    >
      {[...Array(2)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 rounded-lg border-slate-100 p-3">
          <div className="h-10 w-10 shrink-0 rounded-lg bg-slate-200" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-40 max-w-full rounded bg-slate-200" />
            <div className="h-3 w-24 rounded bg-slate-200" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Estado sem documentos + botão para abrir o formulário. */
function DocumentsEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl border-dashed border-slate-300 bg-white p-6 text-center sm:p-8">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
        <FileText className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="mx-auto mt-4 max-w-md text-sm text-slate-500">
        Esta compra ainda não possui documentos
      </p>
      <div className="mt-5 flex justify-center">
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          <Upload className="h-4 w-4" aria-hidden="true" />
          <span>Adicionar documento</span>
        </button>
      </div>
    </div>
  )
}

/** Estado de erro com retry real. */
function DocumentsErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="rounded-2xl border-slate-200 bg-white p-6 text-center sm:p-8">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
        <AlertCircle className="h-6 w-6 text-amber-600" aria-hidden="true" />
      </div>
      <p className="mx-auto mt-3 max-w-md text-sm text-slate-500">{message}</p>
      <div className="mt-5 flex justify-center">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          <span>Tentar novamente</span>
        </button>
      </div>
    </div>
  )
}

interface DocumentItemProps {
  document: Document
  isDeleting: boolean
  isBusy: boolean
  isExtracting: boolean
  isExtractBusy: boolean
  onDelete: (document: Document) => void
  onExtract: (document: Document) => void
  onAuthError: () => void
  onViewError: (message: string) => void
}

function DocumentItem({
  document,
  isDeleting,
  isBusy,
  isExtracting,
  isExtractBusy,
  onDelete,
  onExtract,
  onAuthError,
  onViewError,
}: DocumentItemProps) {
  const [isViewing, setIsViewing] = useState(false)
  const isImage = document.mimeType.startsWith('image/')
  const canExtract = document.type === 'INVOICE'

  const handleView = async () => {
    if (isViewing) return
    setIsViewing(true)
    // Abre a aba no clique (sincronamente) para não ser bloqueada por
    // popup blockers; o Blob é atribuído depois que a requisição resolve.
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
      onViewError(error instanceof ApiError ? error.message : FALLBACK_VIEW_ERROR)
    } finally {
      setIsViewing(false)
    }
  }

  return (
    <li className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center sm:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          {isImage ? (
            <ImageIcon className="h-5 w-5" aria-hidden="true" />
          ) : (
            <FileText className="h-5 w-5" aria-hidden="true" />
          )}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">{document.name}</p>
          <p className="mt-0.5 flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
            <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700 ring-1 ring-emerald-600/20">
              {DOCUMENT_TYPE_LABELS[document.type] ?? DOCUMENT_TYPE_LABELS.OTHER}
            </span>
            <span>{formatFileSize(document.size)}</span>
            <span className="text-slate-300" aria-hidden="true">
              •
            </span>
            <span>Adicionado em {formatDateBR(document.createdAt)}</span>
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        {canExtract && (
          <button
            type="button"
            onClick={() => onExtract(document)}
            disabled={isExtractBusy}
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 shadow-xs transition-colors hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExtracting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{isExtracting ? 'Analisando...' : 'Ler nota com IA'}</span>
          </button>
        )}

        <button
          type="button"
          onClick={handleView}
          disabled={isViewing}
          className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
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
          onClick={() => onDelete(document)}
          disabled={isBusy}
          aria-label={`Excluir documento ${document.name}`}
          className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600 shadow-xs transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isDeleting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          <span>{isDeleting ? 'Excluindo...' : 'Excluir'}</span>
        </button>
      </div>
    </li>
  )
}

interface DocumentFormProps {
  purchaseId: string
  onCancel: () => void
  onCreated: (document: Document) => void
  onAuthError: () => void
}

/** Formulário inline de upload. Envia `file`, `name` e `type` via FormData. */
function DocumentForm({
  purchaseId,
  onCancel,
  onCreated,
  onAuthError,
}: DocumentFormProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<DocumentType>('INVOICE')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const nameError = name.trim() ? null : 'Informe o nome do documento.'

  // Validação básica de arquivo — o backend continua sendo a fonte de verdade.
  const validateFile = validateDocumentFile
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null
    setSubmitError(null)
    if (!selected) {
      setFile(null)
      setFileError(null)
      return
    }
    const error = validateFile(selected)
    setFileError(error)
    setFile(error ? null : selected)
  }

  const isValid = !nameError && !fileError && file !== null

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isUploading || !isValid || !file) return

    setIsUploading(true)
    setSubmitError(null)
    try {
      const document = await uploadPurchaseDocument(purchaseId, file, name.trim(), type)
      onCreated(document)
    } catch (error) {
      if (error instanceof AuthenticationError) {
        onAuthError()
        return
      }
      setSubmitError(error instanceof ApiError ? error.message : FALLBACK_UPLOAD_ERROR)
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-5 rounded-xl border-slate-200 bg-slate-50/60 p-4 sm:p-5"
    >
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label
            htmlFor="document-name"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Nome do documento
          </label>
          <input
            id="document-name"
            name="name"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ex.: Nota fiscal"
            disabled={isUploading}
            aria-invalid={Boolean(nameError)}
            className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:opacity-60 ${
              nameError
                ? 'border-red-300 focus-visible:border-red-400'
                : 'border-slate-300 focus-visible:border-emerald-500'
            }`}
          />
          {nameError && <p className="mt-1.5 text-xs text-red-600">{nameError}</p>}
        </div>

        <div>
          <label
            htmlFor="document-type"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Tipo
          </label>
          <select
            id="document-type"
            name="type"
            value={type}
            onChange={(event) => setType(event.target.value as DocumentType)}
            disabled={isUploading}
            className="w-full rounded-lg border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus-visible:border-emerald-500 focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:opacity-60"
          >
            {DOCUMENT_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {DOCUMENT_TYPE_LABELS[option]}
              </option>
            ))}
          </select>
        </div>

        <div className="sm:col-span-2">
          <label
            htmlFor="document-file"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Arquivo
          </label>
          <input
            id="document-file"
            name="file"
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={handleFileChange}
            disabled={isUploading}
            aria-invalid={Boolean(fileError)}
            className={`block w-full cursor-pointer rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-700 file:mr-3 file:cursor-pointer file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-slate-700 hover:file:bg-slate-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:opacity-60 ${
              fileError
                ? 'border-red-300 focus-visible:border-red-400'
                : 'border-slate-300 focus-visible:border-emerald-500'
            }`}
          />
          <p className="mt-1.5 text-xs text-slate-500">
            PDF, JPG ou PNG, com no máximo 10 MB.
          </p>
          {file && !fileError && (
            <p className="mt-1 text-xs text-slate-500">
              {file.name} • {formatFileSize(file.size)}
            </p>
          )}
          {fileError && <p className="mt-1.5 text-xs text-red-600">{fileError}</p>}
        </div>
      </div>

      {submitError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0 translate-y-0.5" aria-hidden="true" />
          <span>{submitError}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isUploading}
          className="inline-flex cursor-pointer items-center justify-center rounded-lg border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!isValid || isUploading}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>Enviando...</span>
            </>
          ) : (
            'Enviar documento'
          )}
        </button>
      </div>
    </form>
  )
}
