import { ShoppingBag, Store, Calendar } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Purchase } from '../../types/purchase.ts'
import { formatCurrencyBRL, formatDateBR } from '../../lib/formatters.ts'

export interface PurchasesListProps {
  purchases: Purchase[]
  /**
   * Total de compras antes da busca/filtro. Quando informado e diferente do
   * número exibido, o contador mostra "3 de 12 compras" em vez de "3 compras".
   */
  totalCount?: number
}

/** Junta marca e modelo, exibindo apenas os campos que existem na resposta. */
function brandModelLabel(purchase: Purchase): string {
  return [purchase.brand, purchase.model]
    .map((value) => (typeof value === 'string' ? value.trim() : ''))
    .filter(Boolean)
    .join(' ')
}

/**
 * Rótulo da categoria vinda da API. Categoria é obrigatória no backend, mas
 * tratamos um eventual valor vazio para nunca renderizar um badge em branco.
 * Nenhuma categoria é inventada aqui: exibimos exatamente o valor retornado.
 */
function categoryLabel(purchase: Purchase): string | null {
  return typeof purchase.category === 'string' && purchase.category.trim() !== ''
    ? purchase.category
    : null
}

export function PurchasesList({ purchases, totalCount }: PurchasesListProps) {
  const count = purchases.length
  const isFiltered = typeof totalCount === 'number' && totalCount !== count
  // "1 item" / "3 de 12 itens" — singular apenas quando o exibido é 1.
  const counterLabel = isFiltered
    ? `${count} de ${totalCount} ${totalCount === 1 ? 'item' : 'itens'}`
    : `${count} ${count === 1 ? 'item' : 'itens'}`

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
          <span aria-live="polite" className="text-xs font-medium text-slate-400">
            {counterLabel}
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
              <th scope="col" className="px-3 py-3 lg:px-4">
                Categoria
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {purchases.map((purchase) => {
              const brandModel = brandModelLabel(purchase)
              const category = categoryLabel(purchase)
              return (
                <tr key={purchase.id} className="transition-colors hover:bg-slate-50/60">
                  <td className="px-3.5 py-3.5 lg:px-5">
                    {/* Produto é o alvo do clique: leva aos detalhes. */}
                    <Link
                      to={`/purchases/${purchase.id}`}
                      className="group flex items-center gap-2.5 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                        <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-900 group-hover:text-emerald-700">
                          {purchase.productName}
                        </span>
                        {brandModel && (
                          <span className="mt-0.5 block truncate text-xs text-slate-500">
                            {brandModel}
                          </span>
                        )}
                      </span>
                    </Link>
                  </td>
                  <td className="px-3 py-3.5 text-slate-600 lg:px-4">
                    {purchase.store ? (
                      <span className="flex min-w-0 items-center gap-1.5">
                        <Store
                          className="h-3.5 w-3.5 shrink-0 text-slate-400"
                          aria-hidden="true"
                        />
                        <span className="truncate">{purchase.store}</span>
                      </span>
                    ) : (
                      /* Campo opcional ausente: mostra só o placeholder, nunca `null`. */
                      <span className="text-slate-400">-</span>
                    )}
                  </td>
                  <td className="px-3 py-3.5 text-slate-500 whitespace-nowrap lg:px-4">
                    {formatDateBR(purchase.purchaseDate)}
                  </td>
                  <td className="px-3 py-3.5 text-right text-sm font-semibold text-slate-900 whitespace-nowrap tabular-nums lg:px-4">
                    {formatCurrencyBRL(purchase.price)}
                  </td>
                  <td className="px-3 py-3.5 whitespace-nowrap lg:px-4">
                    {category && (
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 ring-1 ring-slate-900/10 lg:text-xs">
                        {category}
                      </span>
                    )}
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
          const category = categoryLabel(purchase)
          return (
            <Link
              key={purchase.id}
              to={`/purchases/${purchase.id}`}
              className="block p-4 transition-colors hover:bg-slate-50/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600"
            >
              {/* 1 e 2: produto e valor lideram a leitura do card. */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <ShoppingBag className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold text-slate-900">
                      {purchase.productName}
                    </span>
                    {brandModel && (
                      <span className="mt-0.5 block truncate text-xs text-slate-500">
                        {brandModel}
                      </span>
                    )}
                  </span>
                </div>
                <span className="shrink-0 text-sm font-bold text-slate-900 tabular-nums">
                  {formatCurrencyBRL(purchase.price)}
                </span>
              </div>

              {/* 3 e 4: data e loja dividem a linha; quebram se faltar espaço. */}
              <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 text-xs text-slate-500">
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <Calendar
                    className="h-3.5 w-3.5 shrink-0 text-slate-400"
                    aria-hidden="true"
                  />
                  <span>{formatDateBR(purchase.purchaseDate)}</span>
                </span>
                {purchase.store && (
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Store
                      className="h-3.5 w-3.5 shrink-0 text-slate-400"
                      aria-hidden="true"
                    />
                    <span className="truncate">{purchase.store}</span>
                  </span>
                )}
              </div>

              {category && (
                <span className="mt-3 inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-900/10">
                  {category}
                </span>
              )}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
