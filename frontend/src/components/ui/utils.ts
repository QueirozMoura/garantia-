/**
 * Combina classes sem adicionar uma dependência de runtime de UI.
 * Strings, arrays e valores condicionais são suficientes para os primitives.
 */
type ClassValue = string | boolean | null | undefined | ClassValue[]

export function cn(...values: ClassValue[]): string {
  return values
    .flatMap((value) => {
      if (Array.isArray(value)) return value
      if (typeof value === 'string') return value.split(' ')
      return value ? [String(value)] : []
    })
    .filter(Boolean)
    .join(' ')
}

export const visualTokens = {
  surface: 'border-slate-200 bg-white',
  mutedSurface: 'border-slate-200 bg-slate-50',
  focus:
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2',
  transition: 'transition-colors duration-150 ease-out',
  radius: 'rounded-xl',
  shadow: 'shadow-sm shadow-slate-900/[0.03]',
} as const
