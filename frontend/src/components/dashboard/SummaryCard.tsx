import type { LucideIcon } from 'lucide-react'
import { cn } from '../ui/utils.ts'

export interface SummaryCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  variant?: 'default' | 'warning'
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

  return (
    <div
      className={cn(
        `group relative overflow-hidden rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_-20px_rgb(15_23_42/0.45)] ${
          isWarning
            ? 'border-amber-200/80 bg-amber-50/60 hover:border-amber-300'
            : 'border-slate-200/80 bg-white/90 hover:border-emerald-200'
        }`,
        className,
      )}
    >
      <span
        className={`absolute inset-x-0 top-0 h-0.5 ${isWarning ? 'bg-amber-400' : 'bg-emerald-500/70'}`}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-slate-500 uppercase">
          {title}
        </span>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            isWarning ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-700'
          }`}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-3">
        <p
          className={`text-2xl font-bold tracking-tight sm:text-3xl ${
            isWarning ? 'text-amber-950' : 'text-slate-950'
          }`}
        >
          {value}
        </p>
        {subtitle && (
          <p
            className={`mt-1 text-xs ${
              isWarning ? 'text-amber-700/90 font-medium' : 'text-slate-500'
            }`}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  )
}
