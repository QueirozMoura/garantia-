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
        'relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/70 p-5 shadow-[0_8px_30px_-24px_rgb(15_23_42/0.4)] sm:p-6',
        'before:absolute before:inset-y-0 before:left-0 before:w-1 before:bg-emerald-500',
        'flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="relative">
        <p className="mb-2 text-[10px] font-bold tracking-[0.18em] text-emerald-600 uppercase">
          Área protegida
        </p>
        <h2 className="text-2xl font-bold tracking-[-0.03em] text-slate-950 sm:text-3xl">
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
