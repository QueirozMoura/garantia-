import { ArrowUpRight, Clock3, ShieldAlert } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { ExpiringWarranty } from '../../types/dashboard.ts'
import { formatDateBR } from '../../lib/formatters.ts'

export interface ExpiringWarrantyCardProps {
  warranties: ExpiringWarranty[]
}

function getElapsedPercentage(startDate: string | Date, endDate: string | Date) {
  const start = new Date(startDate).getTime()
  const end = new Date(endDate).getTime()
  const now = Date.now()
  const duration = end - start

  if (!Number.isFinite(start) || !Number.isFinite(end) || duration <= 0) return 100
  return Math.min(100, Math.max(0, ((now - start) / duration) * 100))
}

export function ExpiringWarrantyCard({ warranties }: ExpiringWarrantyCardProps) {
  return (
    <div className="relative h-full overflow-hidden rounded-[1.5rem] border border-amber-200/80 bg-amber-50/65 p-5 shadow-[0_16px_38px_-32px_rgb(146_64_14/0.5)] sm:p-6">
      <div
        className="absolute -right-16 -top-20 h-48 w-48 rounded-full border border-amber-200/50"
        aria-hidden="true"
      />
      <div
        className="absolute -right-8 -top-12 h-32 w-32 rounded-full bg-amber-200/25 blur-2xl"
        aria-hidden="true"
      />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <ShieldAlert className="h-4.5 w-4.5" aria-hidden="true" />
            </div>
            <p className="text-[10px] font-bold tracking-[0.16em] text-amber-800 uppercase">
              Atenção necessária
            </p>
          </div>
          <h3 className="mt-4 text-xl font-semibold tracking-[-0.025em] text-slate-950">
            Garantias vencendo em breve
          </h3>
          <p className="mt-1 text-sm leading-5 text-slate-600">
            Acompanhe os prazos que pedem sua atenção nos próximos 30 dias.
          </p>
        </div>
        <span className="rounded-full bg-white/75 px-2.5 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-700/10">
          {warranties.length}
        </span>
      </div>

      {warranties.length === 0 ? (
        <div className="relative mt-7 rounded-2xl border border-dashed border-amber-200 bg-white/60 px-4 py-8 text-center">
          <Clock3 className="mx-auto h-6 w-6 text-amber-500/70" aria-hidden="true" />
          <p className="mt-3 text-sm font-medium text-slate-700">
            Tudo tranquilo por aqui.
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Nenhuma garantia vence nos próximos 30 dias.
          </p>
        </div>
      ) : (
        <div className="relative mt-6 space-y-3">
          {warranties.map((item) => {
            const isUrgent = item.daysRemaining <= 15
            const brandModel = [item.brand, item.model].filter(Boolean).join(' ')
            const progress = getElapsedPercentage(item.startDate, item.endDate)

            return (
              <Link
                key={item.purchaseId}
                to={`/purchases/${item.purchaseId}`}
                className="group block rounded-2xl border border-amber-200/70 bg-white/75 p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-300 hover:bg-white hover:shadow-[0_12px_24px_-20px_rgb(146_64_14/0.55)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {item.productName}
                    </p>
                    {brandModel && (
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {brandModel}
                      </p>
                    )}
                  </div>
                  <ArrowUpRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-amber-700" />
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 text-xs">
                  <span className="text-slate-500">
                    Vence em{' '}
                    <strong className="font-semibold text-slate-700">
                      {formatDateBR(item.endDate)}
                    </strong>
                  </span>
                  <span
                    className={
                      isUrgent
                        ? 'font-semibold text-amber-800'
                        : 'font-medium text-slate-600'
                    }
                  >
                    {item.daysRemaining <= 0
                      ? 'Vence hoje'
                      : `${item.daysRemaining} dias`}
                  </span>
                </div>
                <div
                  className="mt-3 h-1.5 overflow-hidden rounded-full bg-amber-100"
                  aria-label={`${Math.round(progress)}% do período da garantia transcorrido`}
                >
                  <div
                    className={`h-full rounded-full transition-[width] duration-500 ${isUrgent ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
