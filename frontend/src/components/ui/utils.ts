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

/** Tokens visuais centralizados — usados em todos os componentes UI. */
export const visualTokens = {
  // Surfaces
  surface: 'border-slate-200 bg-white',
  mutedSurface: 'border-slate-100 bg-slate-50/60',
  elevatedSurface: 'border-slate-200/80 bg-white shadow-sm',

  // Focus ring
  focus:
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus-visible:ring-offset-2',

  // Transitions
  transition: 'transition-all duration-150 ease-out',
  transitionColors: 'transition-colors duration-150 ease-out',
  transitionShadow: 'transition-[box-shadow,transform] duration-150 ease-out',

  // Border radius
  radius: 'rounded-2xl',
  radiusSm: 'rounded-lg',
  radiusFull: 'rounded-full',

  // Shadows
  shadow: 'shadow-[0_8px_24px_-20px_rgb(15_23_42/0.5)]',
  shadowMd: 'shadow-[0_4px_6px_-1px_rgb(0_0_0/0.07),0_2px_4px_-2px_rgb(0_0_0/0.05)]',
  shadowLg: 'shadow-[0_10px_15px_-3px_rgb(0_0_0/0.08),0_4px_6px_-4px_rgb(0_0_0/0.05)]',
  shadowXl: 'shadow-[0_20px_25px_-5px_rgb(0_0_0/0.08),0_8px_10px_-6px_rgb(0_0_0/0.04)]',

  // Hover elevation (shadow lift + subtle translate)
  hoverElevation:
    'hover:-translate-y-px hover:shadow-[0_4px_6px_-1px_rgb(0_0_0/0.07),0_2px_4px_-2px_rgb(0_0_0/0.05)]',

  // Input base
  input:
    'w-full rounded-lg border bg-white px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40',
  inputNormal: 'border-slate-300 focus-visible:border-emerald-500',
  inputError: 'border-red-300 focus-visible:border-red-400',

  // Label
  label: 'block text-sm font-medium text-slate-700',
  labelSm: 'block text-xs font-medium text-slate-600',

  // Section dividers
  sectionDivider: 'border-t border-slate-100',
} as const
