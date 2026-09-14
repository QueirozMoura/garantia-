import { Badge, type BadgeProps, type BadgeVariant } from './Badge.tsx'

/** Status de domínio já usado pelo frontend e pelo backend. */
export type StatusBadgeStatus =
  | 'active'
  | 'expiring'
  | 'expired'
  | 'upcoming'
  | 'none'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'UPCOMING'
  | 'NONE'

const statusConfig: Record<StatusBadgeStatus, { label: string; variant: BadgeVariant }> =
  {
    active: { label: 'Ativa', variant: 'success' },
    expiring: { label: 'Vencendo em breve', variant: 'warning' },
    expired: { label: 'Expirada', variant: 'neutral' },
    upcoming: { label: 'Ainda não iniciada', variant: 'info' },
    none: { label: 'Sem garantia', variant: 'neutral' },
    ACTIVE: { label: 'Ativa', variant: 'success' },
    EXPIRED: { label: 'Expirada', variant: 'neutral' },
    UPCOMING: { label: 'Ainda não iniciada', variant: 'info' },
    NONE: { label: 'Sem garantia', variant: 'neutral' },
  }

export interface StatusBadgeProps extends Omit<BadgeProps, 'children' | 'variant'> {
  status: StatusBadgeStatus
  label?: string
}

export function StatusBadge({ status, label, ...props }: StatusBadgeProps) {
  const config = statusConfig[status]
  return (
    <Badge {...props} variant={config.variant}>
      {label ?? config.label}
    </Badge>
  )
}
