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
      <div className="group relative overflow-hidden rounded-[1.5rem] border border-emerald-200/80 bg-emerald-50/70 p-5 shadow-[0_16px_38px_-32px_rgb(16_185_129/0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-[0_20px_42px_-30px_rgb(16_185_129/0.42)] sm:p-6">
        <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-emerald-100/70 transition-transform duration-300 group-hover:scale-110" />
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 transition-transform duration-200 group-hover:scale-105">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="relative">
            <p className="text-[10px] font-bold tracking-[0.16em] text-emerald-800 uppercase">
              Proteção vigente
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
              {active}
            </p>
          </div>
        </div>
        <p className="relative mt-5 text-sm text-slate-600">
          Garantias ativas dentro do prazo.
        </p>
      </div>

      <div className="group relative overflow-hidden rounded-[1.5rem] border border-amber-200/80 bg-amber-50/70 p-5 shadow-[0_16px_38px_-32px_rgb(245_158_11/0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-[0_20px_42px_-30px_rgb(245_158_11/0.38)] sm:p-6">
        <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-amber-100/80 transition-transform duration-300 group-hover:scale-110" />
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 transition-transform duration-200 group-hover:scale-105">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div className="relative">
            <p className="text-[10px] font-bold tracking-[0.16em] text-amber-800 uppercase">
              Requer atenção
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
              {expiring}
            </p>
          </div>
        </div>
        <p className="relative mt-5 text-sm text-slate-600">
          Vencem nos próximos 30 dias.
        </p>
      </div>

      <div className="group relative overflow-hidden rounded-[1.5rem] border border-red-200/80 bg-red-50/55 p-5 shadow-[0_16px_38px_-32px_rgb(127_29_29/0.35)] transition-all duration-200 hover:-translate-y-0.5 hover:border-red-300 hover:shadow-[0_20px_42px_-30px_rgb(127_29_29/0.3)] sm:p-6">
        <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-red-100/70 transition-transform duration-300 group-hover:scale-110" />
        <div className="flex items-center gap-3">
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-red-100 text-red-700 transition-transform duration-200 group-hover:scale-105">
            <ShieldX className="h-5 w-5" />
          </div>
          <div className="relative">
            <p className="text-[10px] font-bold tracking-[0.16em] text-red-800 uppercase">
              Proteção encerrada
            </p>
            <p className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
              {expired}
            </p>
          </div>
        </div>
        <p className="relative mt-5 text-sm text-slate-600">
          O prazo de cobertura já terminou.
        </p>
      </div>
    </section>
  )
}
