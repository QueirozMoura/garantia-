import { ShieldCheck, ShieldAlert, ShieldX, CalendarClock } from 'lucide-react'
import { getWarrantyStatus, type WarrantyStatus } from '../../lib/warranty-status.ts'
import type { WarrantyWithPurchase } from '../../types/warranty.ts'

export interface WarrantiesSummaryProps {
  warranties: WarrantyWithPurchase[]
  /** Status atualmente filtrado, para destacar o card correspondente. */
  activeStatus?: string
  /** Seleciona o status do card; o toggle (limpar) é decidido pelo pai. */
  onSelectStatus?: (status: WarrantyStatus) => void
}

/**
 * Indicadores de garantias. Cada card é também um atalho de filtro: clicar
 * aplica o status correspondente na listagem. O significado dos contadores não
 * muda — eles continuam contando TODAS as garantias de cada status, mesmo com
 * um filtro ativo.
 */
export function WarrantiesSummary({
  warranties,
  activeStatus,
  onSelectStatus,
}: WarrantiesSummaryProps) {
  let active = 0
  let expiring = 0
  let expired = 0
  let upcoming = 0
  for (const warranty of warranties) {
    const { status } = getWarrantyStatus(warranty)
    if (status === 'active') active += 1
    else if (status === 'expiring') expiring += 1
    else if (status === 'expired') expired += 1
    else if (status === 'upcoming') upcoming += 1
  }

  return (
    <section
      aria-label="Indicadores de garantias"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <SummaryCard
        status="active"
        activeStatus={activeStatus}
        onSelectStatus={onSelectStatus}
        count={active}
        title="Proteção vigente"
        description="Garantias ativas dentro do prazo."
        className="border-emerald-200/80 bg-emerald-50/70 shadow-[0_16px_38px_-32px_rgb(16_185_129/0.55)] hover:border-emerald-300 hover:shadow-[0_20px_42px_-30px_rgb(16_185_129/0.42)]"
        accentClassName="bg-emerald-100/70"
        iconClassName="bg-emerald-100 text-emerald-700"
        titleClassName="text-emerald-800"
        icon={ShieldCheck}
      />

      <SummaryCard
        status="expiring"
        activeStatus={activeStatus}
        onSelectStatus={onSelectStatus}
        count={expiring}
        title="Requer atenção"
        description="Vencem nos próximos 30 dias."
        className="border-amber-200/80 bg-amber-50/70 shadow-[0_16px_38px_-32px_rgb(245_158_11/0.45)] hover:border-amber-300 hover:shadow-[0_20px_42px_-30px_rgb(245_158_11/0.38)]"
        accentClassName="bg-amber-100/80"
        iconClassName="bg-amber-100 text-amber-700"
        titleClassName="text-amber-800"
        icon={ShieldAlert}
      />

      <SummaryCard
        status="expired"
        activeStatus={activeStatus}
        onSelectStatus={onSelectStatus}
        count={expired}
        title="Proteção encerrada"
        description="O prazo de cobertura já terminou."
        className="border-red-200/80 bg-red-50/55 shadow-[0_16px_38px_-32px_rgb(127_29_29/0.35)] hover:border-red-300 hover:shadow-[0_20px_42px_-30px_rgb(127_29_29/0.3)]"
        accentClassName="bg-red-100/70"
        iconClassName="bg-red-100 text-red-700"
        titleClassName="text-red-800"
        icon={ShieldX}
      />

      <SummaryCard
        status="upcoming"
        activeStatus={activeStatus}
        onSelectStatus={onSelectStatus}
        count={upcoming}
        title="Ainda não iniciada"
        description="Proteção que começa em uma data futura."
        className="border-sky-200/80 bg-sky-50/70 shadow-[0_16px_38px_-32px_rgb(14_165_233/0.45)] hover:border-sky-300 hover:shadow-[0_20px_42px_-30px_rgb(14_165_233/0.38)]"
        accentClassName="bg-sky-100/80"
        iconClassName="bg-sky-100 text-sky-700"
        titleClassName="text-sky-800"
        icon={CalendarClock}
      />
    </section>
  )
}

interface SummaryCardProps {
  /** Status que este card representa e que será aplicado ao ser clicado. */
  status: WarrantyStatus
  activeStatus?: string
  onSelectStatus?: (status: WarrantyStatus) => void
  count: number
  title: string
  description: string
  className: string
  accentClassName: string
  iconClassName: string
  titleClassName: string
  icon: typeof ShieldCheck
}

/**
 * Card do resumo. Quando `onSelectStatus` é informado, vira um botão acessível
 * que aplica o filtro de status; o estado ativo é destacado por anel + rótulo
 * "Filtrando", nunca só por cor.
 */
function SummaryCard({
  status,
  activeStatus,
  onSelectStatus,
  count,
  title,
  description,
  className,
  accentClassName,
  iconClassName,
  titleClassName,
  icon: Icon,
}: SummaryCardProps) {
  const isActive = activeStatus === status
  // O pai decide se o clique aplica ou limpa o filtro (toggle); o card apenas
  // reporta o próprio status.
  const interactive = typeof onSelectStatus === 'function'

  const content = (
    <>
      <div
        className={`absolute -right-8 -top-10 h-28 w-28 rounded-full transition-transform duration-300 group-hover:scale-110 ${accentClassName}`}
      />
      <div className="flex items-center gap-3">
        <div
          className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:scale-105 ${iconClassName}`}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="relative">
          <p
            className={`text-[10px] font-bold tracking-[0.16em] uppercase ${titleClassName}`}
          >
            {title}
          </p>
          <p className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-slate-950">
            {count}
          </p>
        </div>
      </div>
      <p className="relative mt-5 text-sm text-slate-600">{description}</p>
      {isActive && (
        <span className="relative mt-3 inline-flex items-center rounded-full bg-slate-950 px-2.5 py-0.5 text-[10px] font-bold tracking-[0.14em] text-white uppercase">
          Filtrando
        </span>
      )}
    </>
  )

  const baseClass = `group relative w-full overflow-hidden rounded-[1.5rem] border p-5 text-left transition-all duration-200 sm:p-6 ${className}`

  if (!interactive) {
    return <div className={baseClass}>{content}</div>
  }

  return (
    <button
      type="button"
      onClick={() => onSelectStatus?.(status)}
      aria-pressed={isActive}
      aria-label={`Filtrar garantias: ${title}`}
      className={`${baseClass} cursor-pointer hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 ${
        isActive ? 'ring-2 ring-slate-900/70 ring-offset-2' : ''
      }`}
    >
      {content}
    </button>
  )
}
