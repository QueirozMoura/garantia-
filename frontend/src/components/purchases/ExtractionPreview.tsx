import type { DocumentExtraction } from '../../types/document.ts'
import { formatCurrencyBRL, formatDateBR } from '../../lib/formatters.ts'
import { NOT_IDENTIFIED } from './purchase-document.ts'

export interface ExtractionPreviewProps {
  /** Dados retornados pela IA (podem conter nulls). */
  data: DocumentExtraction
}

/**
 * Preview somente-leitura dos dados identificados pela IA na nota fiscal.
 *
 * Nesta etapa nada é salvo: apenas apresentamos os campos encontrados, com
 * formatação pt-BR (data, preço em BRL, garantia em meses) e "Não identificado"
 * para valores null. A edição/confirmação é a próxima etapa.
 */
export function ExtractionPreview({ data }: ExtractionPreviewProps) {
  const items: { label: string; value: string }[] = [
    { label: 'Produto', value: data.productName ?? NOT_IDENTIFIED },
    { label: 'Marca', value: data.brand ?? NOT_IDENTIFIED },
    { label: 'Modelo', value: data.model ?? NOT_IDENTIFIED },
    {
      label: 'Data da compra',
      value: data.purchaseDate ? formatDateBR(data.purchaseDate) : NOT_IDENTIFIED,
    },
    {
      label: 'Valor',
      value: data.price === null ? NOT_IDENTIFIED : formatCurrencyBRL(data.price),
    },
    { label: 'Loja', value: data.store ?? NOT_IDENTIFIED },
    { label: 'Número da nota', value: data.invoiceNumber ?? NOT_IDENTIFIED },
    {
      label: 'Garantia',
      value:
        data.warrantyMonths === null ? NOT_IDENTIFIED : `${data.warrantyMonths} meses`,
    },
  ]

  return (
    <div className="rounded-xl border-slate-200 bg-white p-5 sm:p-6">
      <h3 className="text-base font-semibold text-slate-900">Dados encontrados</h3>
      <dl className="mt-4 grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="min-w-0">
            <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              {item.label}
            </dt>
            <dd className="mt-0.5 truncate text-sm text-slate-900">{item.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-xs text-slate-400">
        Estes dados ainda não foram aplicados à compra.
      </p>
    </div>
  )
}
