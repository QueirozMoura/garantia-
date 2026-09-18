import type { HTMLAttributes } from 'react'
import { cn, visualTokens } from './utils.ts'

export type CardVariant =
  'default' | 'interactive' | 'muted' | 'highlight' | 'warning' | 'danger' | 'ai'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
}

const variants: Record<CardVariant, string> = {
  default: `${visualTokens.surface} ${visualTokens.shadow}`,
  interactive: [
    visualTokens.surface,
    visualTokens.shadow,
    'cursor-pointer',
    'hover:border-slate-300',
    'hover:-translate-y-px',
    'hover:shadow-[0_4px_6px_-1px_rgb(0_0_0/0.07),0_2px_4px_-2px_rgb(0_0_0/0.05)]',
  ].join(' '),
  muted: `${visualTokens.mutedSurface} shadow-none`,
  highlight: 'border-emerald-200 bg-emerald-50/50 shadow-none',
  warning: 'border-amber-200 bg-amber-50/60 shadow-none',
  danger: 'border-red-200 bg-red-50/60 shadow-none',
  ai: 'border-violet-100 bg-gradient-to-br from-white to-violet-50/30 shadow-none',
}

export function Card({ variant = 'default', className, tabIndex, ...props }: CardProps) {
  const interactive = variant === 'interactive'
  return (
    <div
      tabIndex={interactive ? 0 : tabIndex}
      className={cn(
        visualTokens.radius,
        'min-w-0 border p-4 sm:p-5',
        'transition-all duration-150 ease-out',
        interactive && visualTokens.focus,
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
