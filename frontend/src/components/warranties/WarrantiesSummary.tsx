import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react'
import { getWarrantyStatus } from '../../lib/warranty-status.ts'
import type { WarrantyWithPurchase } from '../../types/warranty.ts'

export interface WarrantiesSummaryProps {
  warranties: WarrantyWithPurchase[]
}

export function WarrantiesSummary({ warranties }: WarrantiesSummaryProps) {
  let active = 0
  let expiring = 0
  let expired = 0

  for (const warranty of warranties) {
    const { status } = getWarrantyStatus(warranty)
    if (status === 'active') active += 1
    else if (status === 'expiring') expiring += 1
    else if (status === 'expired') expired += 1
  }

  return (
    <section
      aria-label="Indicadores de garantias"
      className="grid grid-cols-1 gap-4 sm:grid-cols-3"
    >
      <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-px hover:shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Ativas</p>
            <p className="text-2xl font-bold text-slate-900">{active}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">Dentro do prazo</p>
      </div>

      <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-px hover:shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Vencendo em breve</p>
            <p className="text-2xl font-bold text-slate-900">{expiring}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">Próximos 30 dias</p>
      </div>

      <div className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-px hover:shadow-md">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
            <ShieldX className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-500">Expiradas</p>
            <p className="text-2xl font-bold text-slate-900">{expired}</p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">Prazo encerrado</p>
      </div>
    </section>
  )
}
