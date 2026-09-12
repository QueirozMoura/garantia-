import { useEffect } from 'react'
import { X } from 'lucide-react'
import { formatCurrencyBRL, formatDateBR } from '../../lib/formatters.ts'
import type { DocumentExtraction } from '../../types/document.ts'

export interface DocumentExtractionPanelProps {
  /** Dados extraídos pela IA (somente leitura nesta etapa). */
  data: DocumentExtraction
  /** Fecha o painel. Nenhum dado é salvo nesta etapa. */
  onClose: () => void
}

/** Exibido quando o backend não identificou um campo. */
const NOT_IDENTIFIED = 'Não identificado'

const formatText = (value: string | null) => value ?? NOT_IDENTIFIED

const formatPrice = (value: number | null) =>
  value === null ? NOT_IDENTIFIED : formatCurrencyBRL(value)

const formatPurchaseDate = (value: string | null) =>
  value === null ? NOT_IDENTIFIED : formatDateBR(value)

const formatWarranty = (value: number | null) =>
  value === null ? NOT_IDENTIFIED : `${value} ${value === 1 ? 'mês' : 'meses'}`

const FIELDS: Array<{ label: string; render: (data: DocumentExtraction) => string }> = [
  { label: 'Produto', render: (d) => formatText(d.productName) },
  { label: 'Marca', render: (d) => formatText(d.brand) },
  { label: 'Modelo', render: (d) => formatText(d.model) },
  { label: 'Data da compra', render: (d) => formatPurchaseDate(d.purchaseDate) },
  { label: 'Preço', render: (d) => formatPrice(d.price) },
  { label: 'Loja', render: (d) => formatText(d.store) },
  { label: 'Número da nota', render: (d) => formatText(d.invoiceNumber) },
  { label: 'Garantia', render: (d) => formatWarranty(d.warrantyMonths) },
]

/**
 * Painel de revisão dos dados extraídos da nota pela IA.
 *
 * Nesta etapa é somente leitura: não há botão de salvar/confirmar e nenhuma
 * chamada além do POST de extração. O usuário apenas revisa e fecha.
 */
export function DocumentExtractionPanel({ data, onClose }: DocumentExtractionPanelProps) {
  // Fecha com Esc e evita rolagem do fundo enquanto o painel está aberto.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
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
      aria-labelledby="document-extraction-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5 sm:p-6">
          <div className="min-w-0">
            <h3
              id="document-extraction-title"
              className="text-base font-semibold text-slate-900 sm:text-lg"
            >
              Dados encontrados na nota
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Revise as informações identificadas pela IA.
            </p>
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

        {/* Campos extraídos */}
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 p-5 sm:grid-cols-2 sm:p-6">
          {FIELDS.map((field) => (
            <div key={field.label} className="min-w-0">
              <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                {field.label}
              </dt>
              <dd className="mt-1 text-sm break-words text-slate-900">
                {field.render(data)}
              </dd>
            </div>
          ))}
        </dl>

        {/* Ação: apenas fechar nesta etapa — nada é salvo. */}
        <div className="flex justify-end border-t border-slate-100 p-5 sm:p-6">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:w-auto"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
