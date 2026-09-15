import { Link } from 'react-router-dom'
import { ArrowRight, CalendarClock, CalendarPlus } from 'lucide-react'
import { formatDateBR } from '../../lib/formatters.ts'
import { getWarrantyStatus, type WarrantyStatus } from '../../lib/warranty-status.ts'
import type { WarrantyWithPurchase } from '../../types/warranty.ts'
import {
  WARRANTY_STATUS_BADGE_CLASSES,
  WARRANTY_STATUS_LABELS,
  formatDaysRemaining,
} from './warranty-presentation.ts'

export interface WarrantyCardProps {
  warranty: WarrantyWithPurchase
}

const STATUS_ICON: Record<WarrantyStatus, typeof CalendarPlus> = {
  active: CalendarClock,
  expiring: CalendarClock,
  expired: CalendarClock,
  upcoming: CalendarPlus,
}

const STATUS_STYLES: Record<
  WarrantyStatus,
  {
    border: string
    bg: string
    iconBg: string
    iconText: string
    hoverBorder: string
    progressColor?: string
  }
> = {
  active: {
    border: 'border-emerald-200',
    bg: 'bg-emerald-50/30',
    iconBg: 'bg-emerald-100',
    iconText: 'text-emerald-600',
    hoverBorder: 'hover:border-emerald-300',
    progressColor: 'bg-emerald-500',
  },
  expiring: {
    border: 'border-amber-200',
    bg: 'bg-amber-50/40',
    iconBg: 'bg-amber-100',
    iconText: 'text-amber-600',
    hoverBorder: 'hover:border-amber-300',
    progressColor: 'bg-amber-500',
  },
  expired: {
    border: 'border-slate-200',
    bg: 'bg-white',
    iconBg: 'bg-slate-100',
    iconText: 'text-slate-500',
    hoverBorder: 'hover:border-slate-300',
  },
  upcoming: {
    border: 'border-sky-200',
    bg: 'bg-sky-50/30',
    iconBg: 'bg-sky-100',
    iconText: 'text-sky-600',
    hoverBorder: 'hover:border-sky-300',
  },
}

export function WarrantyCard({ warranty }: WarrantyCardProps) {
  const { purchase } = warranty
  const { status, daysRemaining } = getWarrantyStatus(warranty)
  const brandModel = [purchase.brand, purchase.model].filter(Boolean).join(' ')
  const StatusIcon = STATUS_ICON[status]
  const styles = STATUS_STYLES[status]

  let pct = 0
  if (status === 'active' || status === 'expiring') {
    const totalTime =
      new Date(warranty.endDate).getTime() - new Date(warranty.startDate).getTime()
    const timePassed = new Date().getTime() - new Date(warranty.startDate).getTime()
    if (totalTime > 0) {
      pct = Math.max(0, Math.min(100, (timePassed / totalTime) * 100))
    }
  }

  return (
    <article
      className={`group rounded-2xl border ${styles.border} ${styles.bg} p-5 shadow-[0_8px_30px_-24px_rgb(15_23_42/0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_14px_32px_-22px_rgb(15_23_42/0.5)] ${styles.hoverBorder} sm:p-6`}
    >
      {/* Cabeçalho: produto + status */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${styles.iconBg} ${styles.iconText} transition-transform duration-200 group-hover:scale-105`}
          >
            <StatusIcon className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-900">
              {purchase.productName}
            </h3>
            {brandModel && (
              <p className="mt-0.5 truncate text-sm text-slate-500">{brandModel}</p>
            )}
          </div>
        </div>

        <span
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
            WARRANTY_STATUS_BADGE_CLASSES[status]
          }`}
        >
          <StatusIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{WARRANTY_STATUS_LABELS[status]}</span>
        </span>
      </div>

      {/* Detalhes */}
      <dl className="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
        <DetailItem label="Categoria" value={purchase.category} />
        <DetailItem label="Duração" value={`${warranty.durationMonths} meses`} />
        <DetailItem label="Início" value={formatDateBR(warranty.startDate)} />
        <DetailItem
          label="Término"
          value={formatDateBR(warranty.endDate)}
          hint={formatDaysRemaining(status, daysRemaining)}
          hintTone={status === 'expiring' ? 'warning' : 'muted'}
        />
      </dl>

      {/* Progress Bar */}
      {(status === 'active' || status === 'expiring') && (
        <div className="mt-5">
          <div className="h-1 w-full rounded-full bg-slate-200">
            <div
              className={`h-1 rounded-full ${styles.progressColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Ação */}
      <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
        <Link
          to={`/purchases/${purchase.id}`}
          className="group inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm"
        >
          <span>Ver compra</span>
          <ArrowRight
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>
    </article>
  )
}

interface DetailItemProps {
  label: string
  value: string
  hint?: string
  hintTone?: 'muted' | 'warning'
}

function DetailItem({ label, value, hint, hintTone = 'muted' }: DetailItemProps) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm text-slate-900">{value}</dd>
      {hint && (
        <p
          className={`mt-0.5 text-xs ${
            hintTone === 'warning' ? 'font-medium text-amber-700' : 'text-slate-500'
          }`}
        >
          {hint}
        </p>
      )}
    </div>
  )
}
