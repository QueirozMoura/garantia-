import { ShoppingBag, Store, Calendar } from 'lucide-react'
import type { RecentPurchase } from '../../data/dashboard.mock.ts'

export interface RecentPurchasesProps {
  purchases: RecentPurchase[]
}

export function RecentPurchases({ purchases }: RecentPurchasesProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {/* Header */}
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Compras recentes</h3>
            <p className="mt-1 text-xs text-slate-500">
              Últimas aquisições e seus respectivos status de cobertura.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-400">
            {purchases.length} itens
          </span>
        </div>
      </div>

      {/* Desktop Table (hidden on mobile/small screens) */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left text-xs lg:text-sm text-slate-600">
          <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            <tr>
              <th scope="col" className="px-3.5 py-3 lg:px-5">
                Produto
              </th>
              <th scope="col" className="px-3 py-3 lg:px-4">
                Loja
              </th>
              <th scope="col" className="px-3 py-3 lg:px-4">
                Data
              </th>
              <th scope="col" className="px-3 py-3 text-right lg:px-4">
                Valor
              </th>
              <th scope="col" className="px-3 py-3 text-right lg:px-4">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {purchases.map((purchase) => {
              const isExpiring = purchase.warrantyStatus === 'expiring'
              return (
                <tr key={purchase.id} className="transition-colors hover:bg-slate-50/60">
                  <td className="px-3.5 py-3.5 lg:px-5 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                        <ShoppingBag className="h-3.5 w-3.5" />
                      </div>
                      <span className="truncate">{purchase.productName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3.5 lg:px-4 text-slate-600">
                    <span className="truncate block">{purchase.store}</span>
                  </td>
                  <td className="px-3 py-3.5 lg:px-4 text-slate-500 whitespace-nowrap">
                    {purchase.purchaseDate}
                  </td>
                  <td className="px-3 py-3.5 text-right font-semibold text-slate-900 whitespace-nowrap lg:px-4">
                    {purchase.amount}
                  </td>
                  <td className="px-3 py-3.5 text-right whitespace-nowrap lg:px-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] lg:text-xs font-medium ${
                        isExpiring
                          ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-600/20'
                          : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                      }`}
                    >
                      {purchase.warrantyLabel}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile Card List (shown only on mobile) */}
      <div className="divide-y divide-slate-100 sm:hidden">
        {purchases.map((purchase) => {
          const isExpiring = purchase.warrantyStatus === 'expiring'
          return (
            <div key={purchase.id} className="p-4 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <ShoppingBag className="h-4 w-4" />
                  </div>
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {purchase.productName}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-slate-900">
                  {purchase.amount}
                </p>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <div className="flex items-center gap-1.5 truncate">
                  <Store className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{purchase.store}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>{purchase.purchaseDate}</span>
                </div>
              </div>

              <div className="pt-1">
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    isExpiring
                      ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-600/20'
                      : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20'
                  }`}
                >
                  {purchase.warrantyLabel}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
