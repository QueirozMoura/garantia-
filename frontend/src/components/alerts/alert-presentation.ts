import { AlertTriangle, CalendarClock, type LucideIcon } from 'lucide-react'
import type { AlertType } from '../../types/alert.ts'

/**
 * Apresentação visual por tipo de alerta. Os rótulos de título/mensagem vêm do
 * backend e não são recalculados aqui — só o estilo (ícone/cores) é decidido no
 * frontend.
 */
export const ALERT_PRESENTATION: Record<
  AlertType,
  {
    icon: LucideIcon
    /** Cor do ícone e do bloco de destaque. */
    accent: string
    iconWrapper: string
    badge: string
    /** Rótulo curto do status exibido no card. */
    statusLabel: string
  }
> = {
  WARRANTY_EXPIRING: {
    icon: CalendarClock,
    accent: 'text-amber-600',
    iconWrapper: 'bg-amber-50 text-amber-600',
    badge: 'bg-amber-50 text-amber-700 ring-amber-600/20',
    statusLabel: 'Vencendo em breve',
  },
  WARRANTY_EXPIRED: {
    icon: AlertTriangle,
    accent: 'text-red-600',
    iconWrapper: 'bg-red-50 text-red-600',
    badge: 'bg-red-50 text-red-700 ring-red-600/20',
    statusLabel: 'Vencida',
  },
}

/** Apresentação segura para um tipo recebido, com fallback para "vencendo". */
export function alertPresentation(type: AlertType) {
  return ALERT_PRESENTATION[type] ?? ALERT_PRESENTATION.WARRANTY_EXPIRING
}
