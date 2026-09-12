import { AlertCircle, RefreshCw, Lock } from 'lucide-react'

export interface DashboardErrorStateProps {
  message?: string
  isAuthError?: boolean
  onRetry: () => void
}

export function DashboardErrorState({
  message,
  isAuthError = false,
  onRetry,
}: DashboardErrorStateProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center sm:p-12 shadow-xs">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
        {isAuthError ? (
          <Lock className="h-6 w-6 text-slate-600" aria-hidden="true" />
        ) : (
          <AlertCircle className="h-6 w-6 text-amber-600" aria-hidden="true" />
        )}
      </div>

      <h3 className="mt-4 text-base font-semibold text-slate-900 sm:text-lg">
        {isAuthError
          ? 'Autenticação necessária'
          : 'Não foi possível carregar o dashboard'}
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        {message ||
          (isAuthError
            ? 'Para visualizar suas compras e garantias, faça login na sua conta.'
            : 'Ocorreu uma instabilidade momentânea ao buscar suas informações.')}
      </p>

      <div className="mt-6 flex justify-center">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          <span>Tentar novamente</span>
        </button>
      </div>
    </div>
  )
}
