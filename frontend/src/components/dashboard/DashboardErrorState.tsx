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
    <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-[0_18px_44px_-34px_rgb(15_23_42/0.5)] sm:p-12">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
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
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-all duration-200 hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.98]"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          <span>Tentar novamente</span>
        </button>
      </div>
    </div>
  )
}
