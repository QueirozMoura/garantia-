import {
  cloneElement,
  isValidElement,
  type ButtonHTMLAttributes,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from 'react'
import { LoaderCircle } from 'lucide-react'
import { cn, visualTokens } from './utils.ts'

export type ButtonVariant =
  'primary' | 'secondary' | 'ghost' | 'danger' | 'link' | 'outline'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  /** Renderiza o botão como outro elemento, como o Link do React Router. */
  as?: ElementType
  /** Mantém a composição semântica de links/botões sem um elemento intermediário. */
  asChild?: boolean
  /** Alias mantido para as telas existentes durante a transição do design system. */
  isLoading?: boolean
  to?: string
}

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-emerald-600 text-white shadow-[0_1px_2px_0_rgb(0_0_0/0.1)] hover:bg-emerald-700 active:scale-[0.98] active:shadow-none',
  secondary:
    'border border-slate-200 bg-white text-slate-700 shadow-[0_1px_2px_0_rgb(0_0_0/0.05)] hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98]',
  outline:
    'border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 active:scale-[0.98]',
  ghost: 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:scale-[0.98]',
  danger:
    'bg-red-600 text-white shadow-[0_1px_2px_0_rgb(0_0_0/0.1)] hover:bg-red-700 active:scale-[0.98] active:shadow-none',
  link: 'text-emerald-700 underline-offset-4 hover:underline hover:text-emerald-600',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'min-h-8 px-3 text-xs gap-1.5',
  md: 'min-h-10 px-4 text-sm gap-2',
  lg: 'min-h-11 px-5 text-base gap-2',
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  isLoading = false,
  leftIcon,
  rightIcon,
  as: Component = 'button',
  asChild = false,
  to,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const isLoadingState = loading || isLoading
  const isDisabled = disabled || isLoadingState
  const content = (
    <>
      {isLoadingState ? (
        <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
      ) : (
        leftIcon
      )}
      <span>{children}</span>
      {!isLoadingState && rightIcon}
    </>
  )
  const buttonClassName = cn(
    'inline-flex items-center justify-center rounded-lg font-medium',
    'whitespace-nowrap',
    visualTokens.focus,
    'transition-all duration-150 ease-out',
    variants[variant],
    sizes[size],
    'disabled:cursor-not-allowed disabled:opacity-50',
    className,
  )

  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{
      className?: string
      children?: ReactNode
    }>
    return cloneElement(child, {
      className: cn(buttonClassName, child.props.className),
      children: content,
    })
  }

  return (
    <Component
      type={Component === 'button' ? 'button' : undefined}
      to={to}
      disabled={isDisabled}
      aria-busy={isLoadingState || undefined}
      className={buttonClassName}
      {...props}
    >
      {content}
    </Component>
  )
}
