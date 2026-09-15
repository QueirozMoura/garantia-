import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from './utils.ts'

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  /** Variante visual */
  variant?: 'default' | 'dashed'
  className?: string
}

const iconBg: Record<string, string> = {
  default: 'bg-slate-100 text-slate-500',
  brand: 'bg-emerald-50 text-emerald-600',
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'dashed',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-12 text-center sm:py-16',
        variant === 'dashed'
          ? 'rounded-2xl border border-dashed border-slate-300 bg-white'
          : 'rounded-xl bg-slate-50/60',
        className,
      )}
    >
      <div
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-2xl',
          iconBg.brand,
        )}
      >
        <Icon className="h-7 w-7" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-900 sm:text-lg">{title}</h3>
      {description && (
        <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">{description}</p>
      )}
      {action && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action}
        </div>
      )}
    </div>
  )
}
