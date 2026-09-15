import { ShieldCheck, ShieldAlert, ShieldX, CalendarClock } from 'lucide-react'
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

const statusConfig: Record<
  StatusBadgeStatus,
  { label: string; variant: BadgeVariant; icon: typeof ShieldCheck }
> = {
  active: { label: 'Ativa', variant: 'success', icon: ShieldCheck },
  expiring: { label: 'Vencendo em breve', variant: 'warning', icon: ShieldAlert },
  expired: { label: 'Expirada', variant: 'neutral', icon: ShieldX },
  upcoming: { label: 'Ainda não iniciada', variant: 'info', icon: CalendarClock },
  none: { label: 'Sem garantia', variant: 'neutral', icon: ShieldX },
  ACTIVE: { label: 'Ativa', variant: 'success', icon: ShieldCheck },
  EXPIRED: { label: 'Expirada', variant: 'neutral', icon: ShieldX },
  UPCOMING: { label: 'Ainda não iniciada', variant: 'info', icon: CalendarClock },
  NONE: { label: 'Sem garantia', variant: 'neutral', icon: ShieldX },
}

export interface StatusBadgeProps extends Omit<
  BadgeProps,
  'children' | 'variant' | 'icon'
> {
  status: StatusBadgeStatus
  label?: string
  showIcon?: boolean
}

export function StatusBadge({
  status,
  label,
  showIcon = true,
  ...props
}: StatusBadgeProps) {
  const config = statusConfig[status]
  const Icon = config.icon
  return (
    <Badge
      {...props}
      variant={config.variant}
      icon={showIcon ? <Icon className="h-3 w-3" aria-hidden="true" /> : undefined}
    >
      {label ?? config.label}
    </Badge>
  )
}
