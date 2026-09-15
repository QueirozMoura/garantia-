import type { ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { IconButton } from './IconButton.tsx'
import { cn, visualTokens } from './utils.ts'

export type FeedbackMessageVariant = 'success' | 'error' | 'warning' | 'info'

export interface FeedbackMessageProps {
  variant?: FeedbackMessageVariant
  title?: string
  description?: ReactNode
  message?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  onClose?: () => void
  className?: string
}

const config: Record<FeedbackMessageVariant, { icon: ReactNode; classes: string }> = {
  success: {
    icon: <CheckCircle2 />,
    classes: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  },
  error: { icon: <XCircle />, classes: 'border-red-200 bg-red-50 text-red-900' },
  warning: {
    icon: <AlertTriangle />,
    classes: 'border-amber-200 bg-amber-50 text-amber-900',
  },
  info: { icon: <Info />, classes: 'border-sky-200 bg-sky-50 text-sky-900' },
}

export function FeedbackMessage({
  variant = 'info',
  title,
  description,
  message,
  icon,
  action,
  onClose,
  className,
}: FeedbackMessageProps) {
  const role = variant === 'error' ? 'alert' : 'status'
  const icons = config[variant]
  return (
    <div
      role={role}
      className={cn(
        'flex gap-3 border p-4 text-sm motion-safe:animate-[feedback-in_150ms_ease-out]',
        visualTokens.radius,
        icons.classes,
        className,
      )}
    >
      <span aria-hidden="true" className="mt-0.5 shrink-0 [&>svg]:h-5 [&>svg]:w-5">
        {icon ?? icons.icon}
      </span>
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        <div className={cn(title && 'mt-1', 'text-current/80')}>
          {description ?? message}
        </div>
        {action && <div className="mt-3">{action}</div>}
      </div>
      {onClose && (
        <IconButton
          label="Fechar mensagem"
          size="sm"
          onClick={onClose}
          className="shrink-0"
        >
          <X aria-hidden="true" className="h-4 w-4" />
        </IconButton>
      )}
    </div>
  )
}
