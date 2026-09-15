import { ArrowUpRight, CalendarDays, Package, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Purchase } from '../../types/purchase.ts'
import { formatCurrencyBRL, formatDateBR } from '../../lib/formatters.ts'
import { getPurchaseWarrantyStatus } from '../../lib/warranty-status.ts'
import { formatDaysRemaining } from '../warranties/warranty-presentation.ts'
import { StatusBadge } from '../ui'

export interface PurchasesListProps {
  purchases: Purchase[]
  totalCount?: number
}

function brandModelLabel(purchase: Purchase): string {
  return [purchase.brand, purchase.model]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .join(' ')
}

function categoryLabel(purchase: Purchase): string | null {
  return typeof purchase.category === 'string' && purchase.category.trim() !== ''
    ? purchase.category
    : null
}

function PurchaseWarranty({ purchase }: { purchase: Purchase }) {
  const { status, daysRemaining } = getPurchaseWarrantyStatus(purchase.warranty)
  const detail =
    status === 'none'
      ? 'Cobertura não cadastrada'
      : formatDaysRemaining(status, daysRemaining)

  return (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge status={status} size="sm" />
      <span className="text-xs text-slate-400">{detail}</span>
    </div>
  )
}

export function PurchasesList({ purchases, totalCount }: PurchasesListProps) {
  const count = purchases.length
  const isFiltered = typeof totalCount === 'number' && totalCount !== count
  const counterLabel = isFiltered
    ? `${count} de ${totalCount} ${totalCount === 1 ? 'item' : 'itens'}`
    : `${count} ${count === 1 ? 'item' : 'itens'}`

  return (
    <section aria-label="Biblioteca de compras">
      <div className="mb-4 flex items-end justify-between gap-4 px-1">
        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] text-emerald-700 uppercase">
            Seu patrimônio
          </p>
          <h3 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-slate-950">
            Biblioteca de compras
          </h3>
        </div>
        <span aria-live="polite" className="text-xs font-medium text-slate-400">
          {counterLabel}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {purchases.map((purchase) => {
          const brandModel = brandModelLabel(purchase)
          const category = categoryLabel(purchase)

          return (
            <Link
              key={purchase.id}
              to={`/purchases/${purchase.id}`}
              className="group relative overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_12px_30px_-28px_rgb(15_23_42/0.7)] transition-all duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:bg-emerald-50/[0.18] hover:shadow-[0_20px_40px_-28px_rgb(15_23_42/0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2 sm:p-6"
            >
              <div className="absolute inset-x-0 top-0 h-0.5 bg-transparent transition-colors duration-200 group-hover:bg-emerald-500" />
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition-all duration-200 group-hover:rotate-[-3deg] group-hover:bg-emerald-100 group-hover:text-emerald-700">
                  <Package className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="truncate text-base font-semibold tracking-[-0.015em] text-slate-950 transition-colors duration-200 group-hover:text-emerald-800">
                        {purchase.productName}
                      </h4>
                      {brandModel && (
                        <p className="mt-1 truncate text-sm text-slate-500">
                          {brandModel}
                        </p>
                      )}
                    </div>
                    <ArrowUpRight className="h-4.5 w-4.5 shrink-0 text-slate-300 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-emerald-600" />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
                    <span className="inline-flex min-w-0 items-center gap-1.5">
                      <Store
                        className="h-3.5 w-3.5 shrink-0 text-slate-400"
                        aria-hidden="true"
                      />
                      <span className="truncate">
                        {purchase.store ?? 'Loja não informada'}
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
                      <CalendarDays
                        className="h-3.5 w-3.5 shrink-0 text-slate-400"
                        aria-hidden="true"
                      />
                      {formatDateBR(purchase.purchaseDate)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-end justify-between gap-4 border-t border-slate-100 pt-4">
                <div className="min-w-0">
                  <PurchaseWarranty purchase={purchase} />
                  {category && (
                    <span className="mt-2 inline-flex max-w-full truncate rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 ring-1 ring-slate-900/5">
                      {category}
                    </span>
                  )}
                </div>
                <p className="shrink-0 text-lg font-semibold tracking-[-0.02em] text-slate-950 tabular-nums">
                  {formatCurrencyBRL(purchase.price)}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
