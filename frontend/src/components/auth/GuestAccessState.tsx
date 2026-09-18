import type { LucideIcon } from 'lucide-react'
import { Link } from 'react-router-dom'

interface GuestAccessStateProps {
  icon: LucideIcon
  title: string
  description: string
  className?: string
  /**
   * Rota de retorno enviada ao Login via `state.from`. Sem ela o CTA continua
   * apontando para `/login`, mas o usuário volta ao destino padrão pós-login.
   */
  returnTo?: string
}

export function GuestAccessState({
  icon: Icon,
  title,
  description,
  className = '',
  returnTo,
}: GuestAccessStateProps) {
  return (
    <section
      className={`rounded-2xl border-slate-200 bg-white px-6 py-10 text-center shadow-[0_16px_40px_-32px_rgb(15_23_42/0.55)] sm:px-10 sm:py-14 ${className}`}
    >
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
        <Icon className="h-7 w-7" aria-hidden="true" />
      </div>
      <h3 className="mt-5 text-xl font-semibold tracking-[-0.025em] text-slate-950">
        {title}
      </h3>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-500">
        {description}
      </p>
      <div className="mt-7 flex w-full flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
        <Link
          to="/login"
          state={returnTo ? { from: { pathname: returnTo } } : undefined}
          className="inline-flex min-h-10 items-center justify-center rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:w-auto"
        >
          Entrar
        </Link>
        <Link
          to="/register"
          className="inline-flex min-h-10 items-center justify-center rounded-lg border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:w-auto"
        >
          Criar conta
        </Link>
      </div>
    </section>
  )
}
