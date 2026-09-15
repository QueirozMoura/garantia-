import { ArrowRight, CalendarDays, ReceiptText, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { RecentPurchase } from '../../types/dashboard.ts'
import { formatCurrencyBRL, formatDateBR } from '../../lib/formatters.ts'

export interface RecentPurchasesProps {
  purchases: RecentPurchase[]
}

export function RecentPurchases({ purchases }: RecentPurchasesProps) {
  return (
    <div className="h-full overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white shadow-[0_16px_38px_-32px_rgb(15_23_42/0.5)]">
      <div className="flex items-end justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-6">
        <div>
          <p className="text-[10px] font-bold tracking-[0.16em] text-slate-400 uppercase">
            Linha do tempo
          </p>
          <h3 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-slate-950">
            Compras recentes
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            Suas últimas aquisições e cobertura.
          </p>
        </div>
        <Link
          to="/purchases"
          className="group inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-emerald-700 transition-colors hover:text-emerald-800"
        >
          Ver todas
          <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
        </Link>
      </div>

      <div className="divide-y divide-slate-100 px-3 py-2 sm:px-4">
        {purchases.map((purchase) => {
          const brandModel = [purchase.brand, purchase.model].filter(Boolean).join(' ')
          return (
            <Link
              key={purchase.id}
              to={`/purchases/${purchase.id}`}
              className="group flex items-center gap-3 rounded-2xl px-2 py-4 transition-all duration-200 hover:bg-emerald-50/55 sm:gap-4 sm:px-3"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-slate-600 transition-all duration-200 group-hover:bg-emerald-100 group-hover:text-emerald-700">
                <ReceiptText className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="truncate text-sm font-semibold text-slate-900 transition-colors group-hover:text-emerald-800">
                    {purchase.productName}
                  </p>
                  {purchase.category && (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-600/10">
                      {purchase.category}
                    </span>
                  )}
                </div>
                {brandModel && (
                  <p className="mt-0.5 truncate text-xs text-slate-400">{brandModel}</p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Store className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                    {purchase.store ?? 'Loja não informada'}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays
                      className="h-3.5 w-3.5 text-slate-400"
                      aria-hidden="true"
                    />
                    {formatDateBR(purchase.purchaseDate)}
                  </span>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <p className="text-sm font-bold text-slate-900">
                  {formatCurrencyBRL(purchase.price)}
                </p>
                <ArrowRight className="hidden h-4 w-4 text-slate-300 transition-transform duration-200 group-hover:translate-x-1 group-hover:text-emerald-600 sm:block" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
