import type { WarrantyStatus } from '../../lib/warranty-status.ts'

/** Rótulo em português para cada status de garantia. */
export const WARRANTY_STATUS_LABELS: Record<WarrantyStatus, string> = {
  active: 'Ativa',
  expiring: 'Vencendo em breve',
  expired: 'Expirada',
  upcoming: 'Ainda não iniciada',
}

/** Classes do badge (ring + cores) por status, no padrão visual do projeto. */
export const WARRANTY_STATUS_BADGE_CLASSES: Record<WarrantyStatus, string> = {
  active: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  expiring: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  expired: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  upcoming: 'bg-sky-50 text-sky-700 ring-sky-600/20',
}

/**
 * Texto de "dias restantes" para garantias ativas/vencendo.
 * Nunca gera contagens negativas.
 */
export function formatDaysRemaining(
  status: WarrantyStatus,
  daysRemaining: number,
): string {
  if (status === 'expired') return 'Expirada'
  if (daysRemaining <= 0) return 'Vence hoje'
  if (daysRemaining === 1) return '1 dia restante'
  return `${daysRemaining} dias restantes`
}
