import { ShoppingBag, Store, Calendar } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Purchase } from '../../types/purchase.ts'
import { formatCurrencyBRL, formatDateBR } from '../../lib/formatters.ts'

export interface PurchasesListProps {
  purchases: Purchase[]
}

/** Junta marca e modelo, exibindo apenas os campos que existem na resposta. */
function brandModelLabel(purchase: Purchase): string {
  return [purchase.brand, purchase.model].filter(Boolean).join(' ')
}

export function PurchasesList({ purchases }: PurchasesListProps) {
  return (
    <div className="rounded-xl border-slate-200 bg-white">
      {/* Header */}
      <div className="border-b border-slate-100 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Todas as compras</h3>
            <p className="mt-1 text-xs text-slate-500">
              Histórico completo dos produtos cadastrados.
            </p>
          </div>
          <span className="text-xs font-medium text-slate-400">
            {purchases.length} {purchases.length === 1 ? 'item' : 'itens'}
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
                Categoria
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {purchases.map((purchase) => {
              const brandModel = brandModelLabel(purchase)
              return (
                <tr key={purchase.id} className="transition-colors hover:bg-slate-50/60">
                  <td className="px-3.5 py-3.5 lg:px-5 font-medium text-slate-900">
                    <Link
                      to={`/purchases/${purchase.id}`}
                      className="group flex items-center gap-2 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-600">
                        <ShoppingBag className="h-3.5 w-3.5" />
                      </div>
                      <div className="min-w-0">
                        <span className="block truncate group-hover:text-emerald-700">
                          {purchase.productName}
                        </span>
                        {brandModel && (
                          <span className="block truncate text-[11px] text-slate-400">
                            {brandModel}
                          </span>
                        )}
                      </div>
                    </Link>
                  </td>
                  <td className="px-3 py-3.5 lg:px-4 text-slate-600">
                    <span className="truncate block">{purchase.store ?? '-'}</span>
                  </td>
                  <td className="px-3 py-3.5 lg:px-4 text-slate-500 whitespace-nowrap">
                    {formatDateBR(purchase.purchaseDate)}
                  </td>
                  <td className="px-3 py-3.5 text-right font-semibold text-slate-900 whitespace-nowrap lg:px-4">
                    {formatCurrencyBRL(purchase.price)}
                  </td>
                  <td className="px-3 py-3.5 text-right whitespace-nowrap lg:px-4">
                    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] lg:text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20">
                      {purchase.category}
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
          const brandModel = brandModelLabel(purchase)
          return (
            <Link
              key={purchase.id}
              to={`/purchases/${purchase.id}`}
              className="block p-4 space-y-2.5 transition-colors hover:bg-slate-50/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <ShoppingBag className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {purchase.productName}
                    </p>
                    {brandModel && (
                      <p className="truncate text-xs text-slate-400">{brandModel}</p>
                    )}
                  </div>
                </div>
                <p className="shrink-0 text-sm font-bold text-slate-900">
                  {formatCurrencyBRL(purchase.price)}
                </p>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <div className="flex items-center gap-1.5 truncate">
                  <Store className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span className="truncate">{purchase.store ?? '-'}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>{formatDateBR(purchase.purchaseDate)}</span>
                </div>
              </div>

              <div className="pt-1">
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20">
                  {purchase.category}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
