import type { ReactNode } from 'react'
import { cn } from './utils.ts'

export interface SectionHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  action?: ReactNode
  /** Tamanho do título */
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const titleSizes = {
  sm: 'text-sm font-semibold text-slate-900',
  md: 'text-base font-semibold text-slate-900',
  lg: 'text-lg font-semibold text-slate-900',
}

export function SectionHeader({
  title,
  subtitle,
  action,
  size = 'md',
  className,
}: SectionHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h3 className={titleSizes[size]}>{title}</h3>
        {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

/** Variante de header de página (h2 grande com descrição). */
export interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  description?: ReactNode
  action?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({
  title,
  subtitle,
  description,
  action,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <section
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          {title}
        </h2>
        {(subtitle ?? description) && (
          <p className="mt-1 text-sm text-slate-500">{subtitle ?? description}</p>
        )}
      </div>
      {(action ?? actions) && (
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {action ?? actions}
        </div>
      )}
    </section>
  )
}
