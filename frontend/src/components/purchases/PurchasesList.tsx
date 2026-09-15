import { ShoppingBag, Store, Calendar, ArrowUpRight } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Purchase } from '../../types/purchase.ts'
import { formatCurrencyBRL, formatDateBR } from '../../lib/formatters.ts'
import { getPurchaseWarrantyStatus } from '../../lib/warranty-status.ts'
import {
  PURCHASE_WARRANTY_BADGE_CLASSES,
  PURCHASE_WARRANTY_LABELS,
} from '../warranties/warranty-presentation.ts'

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

/**
 * Texto do status de garantia para a listagem. Só acrescenta a duração quando
 * existe garantia — "Sem garantia" não tem duração a mostrar.
 */
function warrantyLabel(purchase: Purchase): string {
  const { status } = getPurchaseWarrantyStatus(purchase.warranty)
  const label = PURCHASE_WARRANTY_LABELS[status]
  if (!purchase.warranty) return label
  return `${label} \u00b7 ${purchase.warranty.durationMonths} ${
    purchase.warranty.durationMonths === 1 ? 'm\u00eas' : 'meses'
  }`
}

/** Badge de status reutilizado na tabela e no card mobile. */
function WarrantyBadge({ purchase }: { purchase: Purchase }) {
  const { status } = getPurchaseWarrantyStatus(purchase.warranty)
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 lg:text-xs ${PURCHASE_WARRANTY_BADGE_CLASSES[status]}`}
    >
      {warrantyLabel(purchase)}
    </span>
  )
}

export function PurchasesList({ purchases, totalCount }: PurchasesListProps) {
  const count = purchases.length
  const isFiltered = typeof totalCount === 'number' && totalCount !== count
  // "1 item" / "3 de 12 itens" — singular apenas quando o exibido é 1.
  const counterLabel = isFiltered
    ? `${count} de ${totalCount} ${totalCount === 1 ? 'item' : 'itens'}`
    : `${count} ${count === 1 ? 'item' : 'itens'}`

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-[0_8px_30px_-24px_rgb(15_23_42/0.45)]">
      {/* Header */}
      <div className="border-b border-slate-100 bg-slate-50/45 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-slate-950">
              Biblioteca de compras
            </h3>
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
        {/* Produto absorve a folga (`w-full` + `min-w` nas demais) para que as
            seis colunas continuem legíveis sem apertar as badges. */}
        <table className="w-full min-w-[46rem] text-left text-xs text-slate-600 lg:text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">
            <tr>
              <th scope="col" className="w-full px-3.5 py-3 lg:px-5">
                Produto
              </th>
              <th scope="col" className="px-3 py-3 whitespace-nowrap lg:px-4">
                Loja
              </th>
              <th scope="col" className="px-3 py-3 whitespace-nowrap lg:px-4">
                Data
              </th>
              <th scope="col" className="px-3 py-3 text-right whitespace-nowrap lg:px-4">
                Valor
              </th>
              <th scope="col" className="px-3 py-3 whitespace-nowrap lg:px-4">
                Garantia
              </th>
              <th scope="col" className="px-3 py-3 whitespace-nowrap lg:px-4">
                Categoria
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {purchases.map((purchase) => {
              const brandModel = brandModelLabel(purchase)
              const category = categoryLabel(purchase)
              return (
                <tr
                  key={purchase.id}
                  className="group transition-colors hover:bg-emerald-50/35"
                >
                  <td className="px-3.5 py-3.5 lg:px-5">
                    {/* Produto é o alvo do clique: leva aos detalhes. */}
                    <Link
                      to={`/purchases/${purchase.id}`}
                      className="group flex items-center gap-2.5 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 transition-transform group-hover:scale-105">
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
                    <WarrantyBadge purchase={purchase} />
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
                <span className="flex shrink-0 items-center gap-2 text-sm font-bold text-slate-900 tabular-nums">
                  {formatCurrencyBRL(purchase.price)}
                  <ArrowUpRight className="h-4 w-4 text-slate-300" />
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

              {/* Garantia e categoria dividem a última linha, sem criar outra. */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <WarrantyBadge purchase={purchase} />
                {category && (
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-900/10">
                    {category}
                  </span>
                )}
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
