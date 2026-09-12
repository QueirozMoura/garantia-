import type { LucideIcon } from 'lucide-react'

export interface SummaryCardProps {
  title: string
  value: string
  subtitle?: string
  icon: LucideIcon
  variant?: 'default' | 'warning'
}

export function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = 'default',
}: SummaryCardProps) {
  const isWarning = variant === 'warning'

  return (
    <div
      className={`rounded-xl border p-5 transition-colors ${
        isWarning
          ? 'border-amber-200/80 bg-amber-50/40 hover:border-amber-300'
          : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium tracking-wide text-slate-500 uppercase">
          {title}
        </span>
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-lg ${
            isWarning ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600'
          }`}
          aria-hidden="true"
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-3">
        <p
          className={`text-2xl font-bold tracking-tight sm:text-3xl ${
            isWarning ? 'text-amber-900' : 'text-slate-900'
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
