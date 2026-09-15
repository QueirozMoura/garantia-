import { Link } from 'react-router-dom'
import { ShoppingBag } from 'lucide-react'
import { formatDateBR } from '../../lib/formatters.ts'
import type { Alert } from '../../types/alert.ts'
import { alertPresentation } from './alert-presentation.ts'
import { Button } from '../ui/Button.tsx'

export interface AlertCardProps {
  alert: Alert
}

export function AlertCard({ alert }: AlertCardProps) {
  const { icon: Icon, iconWrapper, badge, statusLabel } = alertPresentation(alert.type)
  const { purchase, warranty } = alert
  const brandModel = [purchase.brand, purchase.model].filter(Boolean).join(' ')

  const severityBorder =
    alert.type === 'WARRANTY_EXPIRING'
      ? 'border-l-4 border-l-amber-400'
      : 'border-l-4 border-l-slate-400'

  return (
    <article
      className={`group rounded-2xl border border-slate-200/80 ${severityBorder} bg-white/90 p-5 shadow-[0_8px_30px_-24px_rgb(15_23_42/0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-200 hover:shadow-[0_14px_32px_-22px_rgb(15_23_42/0.5)] sm:p-6`}
    >
      {/* Cabeçalho: ícone + título/mensagem + status */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <div
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${iconWrapper}`}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            {/* Título vindo da API — não reescrito no frontend. */}
            <h3 className="text-base font-semibold text-slate-900">{alert.title}</h3>
            <p className="mt-1 text-sm text-slate-600">{alert.message}</p>
          </div>
        </div>

        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${badge}`}
        >
          {statusLabel}
        </span>
      </div>

      {/* Produto relacionado */}
      <div className="mt-4 flex min-w-0 items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3.5 py-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200 shadow-sm">
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-900">
            {purchase.productName}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {brandModel || purchase.category}
          </p>
        </div>
      </div>

      {/* Período da garantia */}
      <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
        <DetailItem label="Início da garantia" value={formatDateBR(warranty.startDate)} />
        <DetailItem label="Término da garantia" value={formatDateBR(warranty.endDate)} />
      </dl>

      {/* Ação */}
      <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
        <Button variant="secondary" asChild>
          <Link to={`/purchases/${purchase.id}`}>Ver compra</Link>
        </Button>
      </div>
    </article>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm text-slate-900">{value}</dd>
    </div>
  )
}
