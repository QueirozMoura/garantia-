import { useEffect, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  FileUp,
  FileText,
  Loader2,
  Upload,
  X,
} from 'lucide-react'

import { ApiError, importNfeXml } from '../../lib/api.ts'
import { formatCurrencyBRL, formatDateBR } from '../../lib/formatters.ts'
import type { NfeImportInvoice } from '../../types/nfe-import.ts'
import { formatFileSize } from '../purchases/purchase-document.ts'
import { nfeImportFriendlyMessage, validateNfeFile } from './nfe-import.ts'

export interface XmlImportDialogProps {
  /** Fecha o modal. Ignorado enquanto o upload está em andamento. */
  onClose: () => void
}

type DialogState =
  | { status: 'idle' }
  | { status: 'ready'; file: File }
  | { status: 'uploading'; file: File }
  | { status: 'success'; invoice: NfeImportInvoice }
  | { status: 'error'; message: string }

/**
 * Importação de XML / NF-e: seleção, envio e prévia dos dados da nota.
 *
 * Fluxo real ligado a `POST /nfe/import` (via `importNfeXml` do API client):
 * o usuário seleciona um `.xml`, o frontend valida extensão/tamanho (5 MB), o
 * backend é a autoridade final, e a prévia exibe SOMENTE os dados retornados.
 *
 * Nesta etapa NADA é persistido: nenhuma compra/garantia é criada e nenhum
 * endpoint de purchases é chamado. O XML não é guardado no navegador.
 *
 * Espelha a UX dos demais dialogs: Escape e clique fora fecham (quando não está
 * enviando), foco vai para o botão seguro, scroll do body travado e layout
 * responsivo (bottom sheet no mobile com conteúdo rolável).
 */
export function XmlImportDialog({ onClose }: XmlImportDialogProps) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<DialogState>({ status: 'idle' })
  const [fileError, setFileError] = useState<string | null>(null)

  const isUploading = state.status === 'uploading'

  // Escape fecha e o foco vai para o botão seguro. Bloqueado durante o upload.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isUploading) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    closeRef.current?.focus()
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose, isUploading])

  const handleClose = () => {
    if (isUploading) return
    onClose()
  }

  const openPicker = () => {
    if (isUploading) return
    inputRef.current?.click()
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null
    // Permite selecionar o mesmo arquivo novamente depois.
    event.target.value = ''
    if (!selected) return

    const error = validateNfeFile(selected)
    if (error) {
      // Arquivo inválido: não envia para a API, mostra mensagem clara.
      setFileError(error)
      setState({ status: 'idle' })
      return
    }

    setFileError(null)
    setState({ status: 'ready', file: selected })
  }

  const handleSubmit = async () => {
    if (state.status !== 'ready') return

    const { file } = state
    setFileError(null)
    setState({ status: 'uploading', file })

    try {
      const invoice = await importNfeXml(file)
      setState({ status: 'success', invoice })
    } catch (error) {
      const message =
        error instanceof ApiError
          ? nfeImportFriendlyMessage(error)
          : nfeImportFriendlyMessage(null)
      setState({ status: 'error', message })
    }
  }

  const resetSelection = () => {
    setFileError(null)
    setState({ status: 'idle' })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="xml-import-title"
      onClick={handleClose}
    >
      <div
        className="flex max-h-[95vh] w-full max-w-xl flex-col rounded-t-2xl bg-white shadow-xl sm:max-h-[90vh] sm:rounded-2xl"
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
                id="xml-import-title"
                className="text-base font-semibold text-slate-900 sm:text-lg"
              >
                Importar XML / NF-e
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {state.status === 'success'
                  ? 'Confira os dados da nota fiscal.'
                  : 'Envie o arquivo XML da sua nota fiscal para visualizar os dados.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isUploading}
            aria-label="Fechar"
            className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border-slate-300 bg-white p-2 text-slate-500 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Corpo rolável (mobile incluso) */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5 sm:p-6">
          {state.status === 'success' ? (
            <InvoicePreview invoice={state.invoice} />
          ) : (
            <UploadForm
              inputRef={inputRef}
              state={state}
              fileError={fileError}
              onSelect={openPicker}
              onRemove={resetSelection}
              onChange={handleFileChange}
            />
          )}
        </div>

        {/* Ações */}
        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 p-5 sm:flex-row sm:justify-end sm:p-6">
          {state.status === 'success' ? (
            <button
              ref={closeRef}
              type="button"
              onClick={handleClose}
              className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:w-auto"
            >
              Fechar
            </button>
          ) : (
            <>
              <button
                ref={closeRef}
                type="button"
                onClick={handleClose}
                disabled={isUploading}
                className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={state.status !== 'ready'}
                className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    <span>Enviando...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" aria-hidden="true" />
                    <span>Enviar XML</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

interface UploadFormProps {
  inputRef: React.RefObject<HTMLInputElement | null>
  state: DialogState
  fileError: string | null
  onSelect: () => void
  onRemove: () => void
  onChange: (event: React.ChangeEvent<HTMLInputElement>) => void
}

/** Estado inicial / arquivo selecionado / enviando / erro. */
function UploadForm({
  inputRef,
  state,
  fileError,
  onSelect,
  onRemove,
  onChange,
}: UploadFormProps) {
  const file =
    state.status === 'ready' || state.status === 'uploading' ? state.file : null
  const isUploading = state.status === 'uploading'

  return (
    <div className="space-y-4">
      <input
        ref={inputRef}
        id="nfe-file"
        name="nfe-file"
        type="file"
        accept=".xml,application/xml,text/xml"
        onChange={onChange}
        disabled={isUploading}
        className="sr-only"
        aria-label="Selecionar arquivo XML da NF-e"
      />

      {!file && (
        <div className="rounded-xl border-dashed border-slate-300 bg-slate-50/60 p-6 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-xs">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="mt-3 text-sm text-slate-600">
            Selecione o arquivo XML da NF-e para importar.
          </p>
          <button
            type="button"
            onClick={onSelect}
            className="mt-4 inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span>Selecionar arquivo XML</span>
          </button>
          <p className="mt-2 text-xs text-slate-500">
            Formato aceito: XML • Tamanho máximo: 5 MB
          </p>
        </div>
      )}

      {file && (
        <div className="rounded-xl border-slate-200 bg-white p-4">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Arquivo selecionado
          </p>
          <div className="mt-3 flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">{formatFileSize(file.size)}</p>
            </div>
          </div>

          {isUploading && (
            <p
              role="status"
              aria-busy="true"
              className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-emerald-700"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
              <span>Processando o XML...</span>
            </p>
          )}

          {!isUploading && (
            <div className="mt-4 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onSelect}
                className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm"
              >
                <Upload className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Trocar arquivo</span>
              </button>
              <button
                type="button"
                onClick={onRemove}
                className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 shadow-xs transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 sm:text-sm"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Remover</span>
              </button>
            </div>
          )}
        </div>
      )}

      {fileError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0 translate-y-0.5" aria-hidden="true" />
          <span>{fileError}</span>
        </div>
      )}

      {state.status === 'error' && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0 translate-y-0.5" aria-hidden="true" />
          <span>{state.message}</span>
        </div>
      )}
    </div>
  )
}

/** Prévia da NF-e processada — somente os dados retornados pela API. */
function InvoicePreview({ invoice }: { invoice: NfeImportInvoice }) {
  const { issuer } = invoice

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5 rounded-lg border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm font-medium text-emerald-800">
        <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>NF-e importada</span>
      </div>

      {/* Dados da NF-e */}
      <div className="rounded-xl border-slate-200 bg-white p-4 sm:p-5">
        <h4 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Dados da NF-e
        </h4>
        <dl className="mt-3 space-y-3">
          <div className="min-w-0">
            <dt className="text-xs text-slate-500">Emitente</dt>
            <dd className="text-sm font-medium text-slate-900">{issuer.name}</dd>
            {issuer.tradeName && (
              <dd className="text-xs text-slate-500">{issuer.tradeName}</dd>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="min-w-0">
              <dt className="text-xs text-slate-500">CNPJ</dt>
              <dd className="text-sm text-slate-900">{issuer.cnpj}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-slate-500">Data de emissão</dt>
              <dd className="text-sm text-slate-900">{formatDateBR(invoice.issuedAt)}</dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-slate-500">Número</dt>
              <dd className="text-sm text-slate-900">
                {invoice.number}
                {invoice.series ? ` · Série ${invoice.series}` : ''}
              </dd>
            </div>
            <div className="min-w-0">
              <dt className="text-xs text-slate-500">Valor total</dt>
              <dd className="text-sm font-semibold text-slate-900">
                {formatCurrencyBRL(invoice.total)}
              </dd>
            </div>
          </div>
        </dl>
      </div>

      {/* Produtos */}
      <div className="rounded-xl border-slate-200 bg-white p-4 sm:p-5">
        <h4 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
          Produtos
        </h4>
        <ul className="mt-3 divide-y divide-slate-100">
          {invoice.items.map((item, index) => (
            <li
              key={`${item.code}-${index}`}
              className="min-w-0 py-3 first:pt-0 last:pb-0"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{item.description}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {item.code ? `${item.code} · ` : ''}
                    {formatQuantity(item.quantity)} {item.unit}
                    {item.ncm ? ` · NCM ${item.ncm}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold text-slate-900">
                    {formatCurrencyBRL(item.totalPrice)}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatCurrencyBRL(item.unitPrice)} / un.
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** Quantidade sem casas decimais quando inteira (2.0000 → 2; 0.5 → 0,5). */
function formatQuantity(value: number): string {
  if (!Number.isFinite(value)) return '0'
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace('.', ',')
}
