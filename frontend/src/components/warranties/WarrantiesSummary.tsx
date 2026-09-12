import { ShieldCheck, ShieldAlert, ShieldX } from 'lucide-react'
import { SummaryCard } from '../dashboard/SummaryCard.tsx'
import { getWarrantyStatus } from '../../lib/warranty-status.ts'
import type { WarrantyWithPurchase } from '../../types/warranty.ts'

export interface WarrantiesSummaryProps {
  warranties: WarrantyWithPurchase[]
}

/**
 * Indicadores derivados no frontend para apresentação. Usa a mesma função
 * centralizada de status dos cards, evitando lógica duplicada.
 */
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
      <SummaryCard
        title="Ativas"
        value={String(active)}
        subtitle="Dentro do prazo"
        icon={ShieldCheck}
      />
      <SummaryCard
        title="Vencendo em breve"
        value={String(expiring)}
        subtitle="Próximos 30 dias"
        icon={ShieldAlert}
        variant="warning"
      />
      <SummaryCard
        title="Expiradas"
        value={String(expired)}
        subtitle="Prazo encerrado"
        icon={ShieldX}
      />
    </section>
  )
}
