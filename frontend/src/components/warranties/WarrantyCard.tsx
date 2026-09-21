import { ArrowRight, CalendarPlus, ShieldAlert, ShieldCheck, ShieldX } from 'lucide-react'
import { Link } from 'react-router-dom'
import { formatDateBR } from '../../lib/formatters.ts'
import { getWarrantyStatus, type WarrantyStatus } from '../../lib/warranty-status.ts'
import type { WarrantyWithPurchase } from '../../types/warranty.ts'
import { StatusBadge } from '../ui'
import { formatDaysRemaining } from './warranty-presentation.ts'

export interface WarrantyCardProps {
  warranty: WarrantyWithPurchase
}

const STATUS_ICON: Record<WarrantyStatus, typeof ShieldCheck> = {
  active: ShieldCheck,
  expiring: ShieldAlert,
  expired: ShieldX,
  upcoming: CalendarPlus,
}

const STATUS_STYLES: Record<
  WarrantyStatus,
  { border: string; surface: string; icon: string; progress: string; track: string }
> = {
  active: {
    border: 'border-emerald-200 hover:border-emerald-300',
    surface: 'bg-white',
    icon: 'bg-emerald-100 text-emerald-700',
    progress: 'bg-emerald-500',
    track: 'bg-emerald-100',
  },
  expiring: {
    border: 'border-amber-200 hover:border-amber-300',
    surface: 'bg-amber-50/35',
    icon: 'bg-amber-100 text-amber-700',
    progress: 'bg-amber-500',
    track: 'bg-amber-100',
  },
  expired: {
    border: 'border-red-200 hover:border-red-300',
    surface: 'bg-red-50/25',
    icon: 'bg-red-100 text-red-700',
    progress: 'bg-red-400',
    track: 'bg-red-100',
  },
  upcoming: {
    border: 'border-sky-200 hover:border-sky-300',
    surface: 'bg-sky-50/30',
    icon: 'bg-sky-100 text-sky-700',
    progress: 'bg-sky-500',
    track: 'bg-sky-100',
  },
}

function getProgress(startDate: string, endDate: string) {
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null
  return Math.min(100, Math.max(0, ((Date.now() - start) / (end - start)) * 100))
}

function getExpiredLabel(endDate: string) {
  const end = new Date(endDate).getTime()
  if (!Number.isFinite(end)) return null
  const days = Math.floor((Date.now() - end) / (24 * 60 * 60 * 1000))
  if (days <= 0) return 'Expirada recentemente'
  return `Expirada há ${days} ${days === 1 ? 'dia' : 'dias'}`
}

export function WarrantyCard({ warranty }: WarrantyCardProps) {
  const { purchase } = warranty
  const { status, daysRemaining } = getWarrantyStatus(warranty)
  const brandModel = [purchase.brand, purchase.model].filter(Boolean).join(' ')
  const category =
    typeof purchase.category === 'string' ? purchase.category.trim() : ''
  const StatusIcon = STATUS_ICON[status]
  const styles = STATUS_STYLES[status]
  const progress = getProgress(warranty.startDate, warranty.endDate)
  const timeLabel =
    status === 'expired'
      ? getExpiredLabel(warranty.endDate)
      : status === 'upcoming'
        ? `Começa em ${daysRemaining} ${daysRemaining === 1 ? 'dia' : 'dias'}`
        : formatDaysRemaining(status, daysRemaining)

  return (
    <article
      className={`group relative overflow-hidden rounded-[1.5rem] border ${styles.border} ${styles.surface} p-5 shadow-[0_14px_34px_-30px_rgb(15_23_42/0.65)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_22px_42px_-28px_rgb(15_23_42/0.55)] sm:p-6`}
    >
      <div className={`absolute inset-x-0 top-0 h-0.5 ${styles.progress}`} />

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${styles.icon} transition-transform duration-200 group-hover:rotate-[-3deg] group-hover:scale-105`}
          >
            <StatusIcon className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-bold tracking-[0.16em] text-slate-400 uppercase">
              Produto protegido
            </p>
            <h3 className="truncate text-lg font-semibold tracking-[-0.025em] text-slate-950">
              {purchase.productName}
            </h3>
            {brandModel && (
              <p className="mt-1 truncate text-sm text-slate-500">{brandModel}</p>
            )}
          </div>
        </div>
        <StatusBadge
          status={status}
          size="md"
          className="self-start transition-colors duration-200"
        />
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 border-t border-slate-100 pt-5 sm:grid-cols-4">
        {category && <DetailItem label="Categoria" value={category} />}
        <DetailItem label="Duração" value={`${warranty.durationMonths} meses`} />
        <DetailItem label="Início" value={formatDateBR(warranty.startDate)} />
        <DetailItem label="Término" value={formatDateBR(warranty.endDate)} />
      </div>

      <div className="mt-6 rounded-2xl border border-slate-100 bg-white/70 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold tracking-[0.16em] text-slate-400 uppercase">
              Linha do tempo da proteção
            </p>
            <p
              className={`mt-1 text-sm font-semibold ${
                status === 'expiring'
                  ? 'text-amber-700'
                  : status === 'expired'
                    ? 'text-red-700'
                    : 'text-slate-700'
              }`}
            >
              {timeLabel ?? 'Período não disponível'}
            </p>
          </div>
          {progress !== null && (
            <span className="text-xs font-medium text-slate-400">
              {Math.round(progress)}% transcorrido
            </span>
          )}
        </div>
        {progress !== null && (
          <div
            className={`mt-3 h-2 overflow-hidden rounded-full ${styles.track}`}
            aria-label={`${Math.round(progress)}% do período da garantia transcorrido`}
          >
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${styles.progress}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        )}
      </div>

      <div className="mt-5 flex justify-end border-t border-slate-100 pt-4">
        <Link
          to={`/purchases/${purchase.id}#warranty`}
          className="group/action inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-all duration-200 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.98] sm:text-sm"
        >
          <span>Ver compra</span>
          <ArrowRight
            className="h-4 w-4 transition-transform duration-200 group-hover/action:translate-x-0.5"
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
}

function DetailItem({ label, value }: DetailItemProps) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold tracking-[0.14em] text-slate-400 uppercase">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-medium text-slate-800">{value}</dd>
    </div>
  )
}
