import type { LucideIcon } from 'lucide-react'
import { cn } from '../ui/utils.ts'

export interface SummaryCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  variant?: 'default' | 'protection' | 'warning' | 'spending'
  className?: string
}

export function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
  className,
}: SummaryCardProps) {
  const isWarning = variant === 'warning'
  const isProtection = variant === 'protection'
  const isSpending = variant === 'spending'

  return (
    <div
      className={cn(
        `group relative min-w-0 overflow-hidden rounded-[1.5rem] border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_32px_-24px_rgb(15_23_42/0.48)] sm:p-6 ${
          isWarning
            ? 'border-amber-200/80 bg-amber-50/70 hover:border-amber-300'
            : isSpending
              ? 'border-slate-800 bg-slate-950 text-white hover:border-slate-700'
              : isProtection
                ? 'border-emerald-200/80 bg-emerald-50/60 hover:border-emerald-300'
                : 'border-slate-200/80 bg-white/90 hover:border-blue-200'
        }`,
        className,
      )}
    >
      <span
        className={`absolute inset-x-0 top-0 h-0.5 ${
          isWarning
            ? 'bg-amber-400'
            : isSpending
              ? 'bg-emerald-400'
              : isProtection
                ? 'bg-emerald-500'
                : 'bg-blue-400'
        }`}
      />
      <div className="flex min-w-0 items-center justify-between gap-3">
        <span
          className={cn(
            'min-w-0 truncate text-xs font-medium tracking-wide uppercase',
            isSpending
              ? 'text-slate-400'
              : isWarning
                ? 'text-amber-700'
                : 'text-slate-500',
          )}
        >
          {title}
        </span>
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-105 ${
            isWarning
              ? 'bg-amber-100 text-amber-700'
              : isProtection
                ? 'bg-emerald-100 text-emerald-700'
                : isSpending
                  ? 'bg-white/10 text-emerald-300'
                  : 'bg-blue-50 text-blue-700'
          }`}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-3">
        <p
          className={`tracking-tight ${
            isSpending
              ? 'text-3xl font-semibold text-white tabular-nums sm:text-4xl'
              : `text-2xl font-bold sm:text-3xl ${
                  isWarning ? 'text-amber-950' : 'text-slate-950'
                  } tabular-nums`
          }`}
        >
          {value}
        </p>
        {subtitle && (
          <p
            className={`mt-1 text-xs ${
              isSpending
                ? 'text-slate-400'
                : isWarning
                  ? 'font-medium text-amber-700/90'
                  : 'text-slate-500'
            }`}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}
