import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn, visualTokens } from './utils.ts'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  wrapperClassName?: string
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, leftIcon, rightIcon, id, wrapperClassName, className, ...props },
  ref,
) {
  const hasError = Boolean(error)
  return (
    <div className={cn('w-full', wrapperClassName)}>
      {label && (
        <label htmlFor={id} className={cn(visualTokens.label, 'mb-1.5')}>
          {label}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400 [&>svg]:h-4 [&>svg]:w-4"
          >
            {leftIcon}
          </span>
        )}
        <input
          ref={ref}
          id={id}
          aria-invalid={hasError || undefined}
          className={cn(
            visualTokens.input,
            leftIcon ? 'pl-10' : 'pl-3',
            rightIcon ? 'pr-10' : 'pr-3',
            hasError ? visualTokens.inputError : visualTokens.inputNormal,
            className,
          )}
          {...props}
        />
        {rightIcon && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-slate-400 [&>svg]:h-4 [&>svg]:w-4"
          >
            {rightIcon}
          </span>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      )}
      {hint && !error && <p className="mt-1.5 text-xs text-slate-500">{hint}</p>}
    </div>
  )
})
