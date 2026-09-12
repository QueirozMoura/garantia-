import { useRef } from 'react'
import { AlertCircle, FileText, Image as ImageIcon, Upload, X } from 'lucide-react'
import {
  ACCEPTED_MIME_TYPES,
  formatFileSize,
  validateDocumentFile,
} from './purchase-document.ts'

export interface InvoiceUploadCardProps {
  /** Arquivo de nota fiscal selecionado (ou null). */
  file: File | null
  /** Mensagem de erro de validação do arquivo (ou null). */
  fileError: string | null
  /** Atualiza o arquivo selecionado (ou null ao remover). */
  onFileChange: (file: File | null, error: string | null) => void
  /** Desabilita as ações enquanto a compra/upload está em andamento. */
  disabled?: boolean
}

/**
 * Destaque para importar a nota fiscal (PDF/JPEG/PNG, até 10 MB).
 *
 * Nesta etapa o arquivo NÃO é lido nem envia nada sozinho: apenas acompanha a
 * compra, que será criada pelo formulário manual existente. O upload do
 * documento acontece depois, quando a compra for criada.
 */
export function InvoiceUploadCard({
  file,
  fileError,
  onFileChange,
  disabled = false,
}: InvoiceUploadCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  const openPicker = () => {
    if (disabled) return
    inputRef.current?.click()
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] ?? null
    // Permite selecionar o mesmo arquivo novamente depois de remover.
    event.target.value = ''
    if (!selected) {
      onFileChange(null, null)
      return
    }
    onFileChange(selected, validateDocumentFile(selected))
  }

  const remove = () => {
    if (disabled) return
    onFileChange(null, null)
  }

  const isImage = Boolean(file && file.type.startsWith('image/'))

  return (
    <section className="rounded-xl border-emerald-200 bg-emerald-50/40 p-5 sm:p-6">
      <div className="flex min-w-0 items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
          <Upload className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-900">Importar nota fiscal</h3>
          <p className="mt-1 text-sm text-slate-600">
            Envie uma foto ou PDF da nota fiscal e facilite o preenchimento da sua compra.
          </p>
        </div>
      </div>

      {/* input file sempre presente para que "Selecionar"/"Trocar" o acionem */}
      <input
        ref={inputRef}
        id="invoice-file"
        name="invoice-file"
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
        onChange={handleChange}
        disabled={disabled}
        className="sr-only"
        aria-label="Selecionar nota fiscal"
      />

      {!file && (
        <div className="mt-5">
          <button
            type="button"
            onClick={openPicker}
            disabled={disabled}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            <span>Selecionar nota fiscal</span>
          </button>
          <p className="mt-2 text-xs text-slate-500">
            Formatos aceitos: PDF, JPG/JPEG e PNG • Tamanho máximo: 10 MB
          </p>
        </div>
      )}

      {file && (
        <div className="mt-5 rounded-xl border-slate-200 bg-white p-4">
          <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
            Nota fiscal selecionada
          </p>
          <div className="mt-3 flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              {isImage ? (
                <ImageIcon className="h-5 w-5" aria-hidden="true" />
              ) : (
                <FileText className="h-5 w-5" aria-hidden="true" />
              )}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{file.name}</p>
              <p className="mt-0.5 text-xs text-slate-500">
                {fileExtensionLabel(file)} • {formatFileSize(file.size)}
              </p>
            </div>
          </div>

          <div className="mt-4 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openPicker}
              disabled={disabled}
              className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Trocar arquivo</span>
            </button>
            <button
              type="button"
              onClick={remove}
              disabled={disabled}
              className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border-red-200 bg-white px-3.5 py-2 text-xs font-semibold text-red-600 shadow-xs transition-colors hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 disabled:cursor-not-allowed disabled:opacity-60 sm:text-sm"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Remover</span>
            </button>
          </div>
        </div>
      )}

      {fileError && (
        <div
          role="alert"
          className="mt-4 flex items-start gap-2.5 rounded-lg border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0 translate-y-0.5" aria-hidden="true" />
          <span>{fileError}</span>
        </div>
      )}
    </section>
  )
}

/** Rótulo curto do formato a partir do MIME, com fallback para a extensão. */
function fileExtensionLabel(file: File): string {
  if (file.type && ACCEPTED_MIME_TYPES.includes(file.type)) {
    if (file.type === 'application/pdf') return 'PDF'
    if (file.type === 'image/jpeg') return 'JPEG'
    if (file.type === 'image/png') return 'PNG'
  }
  const index = file.name.lastIndexOf('.')
  return index >= 0 ? file.name.slice(index + 1).toUpperCase() : 'ARQUIVO'
}
