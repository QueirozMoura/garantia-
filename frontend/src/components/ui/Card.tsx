import type { HTMLAttributes } from 'react'
import { cn, visualTokens } from './utils.ts'

export type CardVariant =
  'default' | 'interactive' | 'muted' | 'highlight' | 'warning' | 'danger'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
}

const variants: Record<CardVariant, string> = {
  default: `${visualTokens.surface} ${visualTokens.shadow}`,
  interactive: `${visualTokens.surface} ${visualTokens.shadow} cursor-pointer hover:border-slate-300 hover:shadow-md`,
  muted: visualTokens.mutedSurface,
  highlight: 'border-emerald-200 bg-emerald-50/50',
  warning: 'border-amber-200 bg-amber-50/60',
  danger: 'border-red-200 bg-red-50/60',
}

export function Card({ variant = 'default', className, tabIndex, ...props }: CardProps) {
  const interactive = variant === 'interactive'
  return (
    <div
      tabIndex={interactive ? 0 : tabIndex}
      className={cn(
        visualTokens.radius,
        'border p-4 sm:p-5',
        visualTokens.transition,
        interactive && visualTokens.focus,
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
