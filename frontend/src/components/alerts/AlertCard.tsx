import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock, Clock3, ShoppingBag } from 'lucide-react'
import { formatDateBR } from '../../lib/formatters.ts'
import { daysUntil } from '../../lib/warranty-status.ts'
import type { Alert } from '../../types/alert.ts'
import { alertPresentation } from './alert-presentation.ts'
import { Button } from '../ui/Button.tsx'

export interface AlertCardProps {
  alert: Alert
}

function getTimeContext(alert: Alert) {
  if (alert.type === 'WARRANTY_EXPIRING') {
    const days = daysUntil(alert.warranty.endDate)
    if (days <= 0) return 'Vence hoje'
    return `${days} ${days === 1 ? 'dia' : 'dias'} restantes`
  }

  // Alerta expirado: usa a MESMA âncora UTC/calendário de `daysUntil` (mesma
  // regra do backend e do ramo de vencimento próximo), evitando divergência de
  // ±1 dia que o cálculo com `Date.now()`/`Math.floor` poderia introduzir.
  const days = Math.max(0, -daysUntil(alert.warranty.endDate))
  return `Expirada há ${days} ${days === 1 ? 'dia' : 'dias'}`
}

export function AlertCard({ alert }: AlertCardProps) {
  const { icon: Icon, iconWrapper, badge, statusLabel } = alertPresentation(alert.type)
  const { purchase, warranty } = alert
  const brandModel = [purchase.brand, purchase.model].filter(Boolean).join(' ')
  const isExpired = alert.type === 'WARRANTY_EXPIRED'
  const timeContext = getTimeContext(alert)

  return (
    <article
      className={`group relative overflow-hidden rounded-[1.5rem] border p-5 shadow-[0_14px_34px_-30px_rgb(15_23_42/0.65)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_22px_42px_-28px_rgb(15_23_42/0.55)] sm:p-6 ${
        isExpired
          ? 'border-red-200 bg-red-50/30 hover:border-red-300'
          : 'border-amber-200 bg-amber-50/35 hover:border-amber-300'
      }`}
    >
      <div
        className={`absolute inset-x-0 top-0 h-0.5 ${
          isExpired ? 'bg-red-500' : 'bg-amber-500'
        }`}
      />

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${iconWrapper} transition-transform duration-200 group-hover:rotate-[-3deg] group-hover:scale-105`}
          >
            <Icon className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p
              className={`mb-1 text-[10px] font-bold tracking-[0.16em] uppercase ${
                isExpired ? 'text-red-700' : 'text-amber-800'
              }`}
            >
              {isExpired ? 'Prioridade crítica' : 'Atenção necessária'}
            </p>
            <h3 className="text-lg font-semibold tracking-[-0.025em] text-slate-950">
              {alert.title}
            </h3>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-slate-600">
              {alert.message}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${badge}`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="mt-5 flex min-w-0 items-center gap-3 rounded-2xl border border-white/70 bg-white/75 px-4 py-3.5 transition-colors duration-200 group-hover:bg-white">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-xs ring-1 ring-slate-200">
          <ShoppingBag className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase">
            Produto relacionado
          </p>
          <p className="mt-1 truncate text-sm font-semibold text-slate-900">
            {purchase.productName}
          </p>
          <p className="mt-0.5 truncate text-xs text-slate-500">
            {brandModel || purchase.category}
          </p>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-white/70 pt-5 sm:grid-cols-3">
        <DetailItem label="Início da garantia" value={formatDateBR(warranty.startDate)} />
        <DetailItem label="Término da garantia" value={formatDateBR(warranty.endDate)} />
        <div className="min-w-0">
          <dt className="text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase">
            Situação temporal
          </dt>
          <dd
            className={`mt-1 flex items-center gap-1.5 text-sm font-semibold ${isExpired ? 'text-red-700' : 'text-amber-800'}`}
          >
            {isExpired ? (
              <Clock3 className="h-4 w-4" />
            ) : (
              <CalendarClock className="h-4 w-4" />
            )}
            {timeContext}
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex justify-end border-t border-white/70 pt-4">
        <Button variant="secondary" asChild>
          <Link
            to={`/purchases/${purchase.id}#warranty`}
            className="group/action inline-flex items-center gap-2"
          >
            Ver compra
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/action:translate-x-0.5" />
          </Link>
        </Button>
      </div>
    </article>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-medium text-slate-800">{value}</dd>
    </div>
  )
}
