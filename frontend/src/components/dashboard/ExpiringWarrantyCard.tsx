import { Clock, ShieldAlert } from 'lucide-react'
import type { ExpiringWarranty } from '../../types/dashboard.ts'
import { formatDateBR } from '../../lib/formatters.ts'

export interface ExpiringWarrantyCardProps {
  warranties: ExpiringWarranty[]
}

export function ExpiringWarrantyCard({ warranties }: ExpiringWarrantyCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      {/* Section Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-slate-900">
              Garantias vencendo em breve
            </h3>
            <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-600/20">
              {warranties.length}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Fique de olho nas garantias que estão próximas do vencimento.
          </p>
        </div>
      </div>

      {/* Warranties List or Empty */}
      {warranties.length === 0 ? (
        <div className="mt-5 rounded-lg bg-slate-50 px-4 py-6 text-center">
          <p className="text-xs text-slate-500">
            Nenhuma garantia vencendo nos próximos 30 dias.
          </p>
        </div>
      ) : (
        <div className="mt-5 divide-y divide-slate-100">
          {warranties.map((item) => {
            const isUrgent = item.daysRemaining <= 15
            const brandModel = [item.brand, item.model].filter(Boolean).join(' ')

            return (
              <div
                key={item.purchaseId}
                className="flex flex-col gap-2 py-3.5 first:pt-0 last:pb-0"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-slate-900">
                      {item.productName}
                    </p>
                    {brandModel && (
                      <p className="mt-0.5 text-xs text-slate-500">{brandModel}</p>
                    )}
                    <p className="mt-0.5 text-xs text-slate-400">
                      Garantia até{' '}
                      <span className="font-medium text-slate-600">
                        {formatDateBR(item.endDate)}
                      </span>
                    </p>
                  </div>

                  {/* Badge com dias restantes */}
                  <span
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      isUrgent
                        ? 'bg-amber-100/80 text-amber-900 ring-1 ring-amber-500/30'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {isUrgent ? (
                      <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-700" />
                    ) : (
                      <Clock className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    )}
                    <span>
                      {item.daysRemaining <= 0
                        ? 'Vence hoje'
                        : `${item.daysRemaining} dias restantes`}
                    </span>
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
