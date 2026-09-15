import { useCallback, useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { BellRing, CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react'
import { AlertCard } from '../components/alerts/AlertCard.tsx'
import { AlertsSkeleton } from '../components/alerts/AlertsSkeleton.tsx'
import { AlertsEmptyState } from '../components/alerts/AlertsEmptyState.tsx'
import { AlertsErrorState } from '../components/alerts/AlertsErrorState.tsx'
import { getAlerts, AuthenticationError, ApiError } from '../lib/api.ts'
import { useAuth } from '../contexts/auth-context.ts'
import type { Alert } from '../types/alert.ts'

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; alerts: Alert[] }

const TITLE = 'Alertas'
const FALLBACK_ERROR = 'Não foi possível carregar seus alertas.'

export function Alerts() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [state, setState] = useState<FetchState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let isActive = true
    const load = async () => {
      try {
        const alerts = await getAlerts()
        if (isActive) setState({ status: 'success', alerts })
      } catch (error) {
        if (!isActive) return
        if (error instanceof AuthenticationError) {
          // Token inválido/expirado: encerra a sessão global e volta ao login.
          setUser(null)
          navigate('/login', { replace: true })
          return
        }
        const message = error instanceof ApiError ? error.message : FALLBACK_ERROR
        setState({ status: 'error', message })
      }
    }

    void load()

    return () => {
      isActive = false
    }
  }, [reloadKey, navigate, setUser])

  const handleRetry = useCallback(() => {
    setState({ status: 'loading' })
    setReloadKey((key) => key + 1)
  }, [])

  const expiringAlerts = useMemo(() => {
    if (state.status !== 'success') return []
    return state.alerts.filter((a) => a.type === 'WARRANTY_EXPIRING')
  }, [state])

  const expiredAlerts = useMemo(() => {
    if (state.status !== 'success') return []
    return state.alerts.filter((a) => a.type === 'WARRANTY_EXPIRED')
  }, [state])

  return (
    <div className="space-y-8 sm:space-y-10">
      <section
        className={`relative isolate overflow-hidden rounded-[2rem] border px-6 py-7 shadow-[0_24px_60px_-38px_rgb(15_23_42/0.7)] sm:px-9 sm:py-9 ${
          state.status === 'success' && state.alerts.length === 0
            ? 'border-emerald-200 bg-emerald-950'
            : 'border-slate-800 bg-slate-950'
        }`}
      >
        <div className="surface-grid absolute inset-0 -z-10 opacity-20 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="absolute -right-20 -top-24 -z-10 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute bottom-[-5rem] right-[18%] -z-10 h-40 w-40 rounded-full border border-amber-300/10" />
        <div className="absolute bottom-[-6rem] right-[10%] -z-10 h-56 w-56 rounded-full border border-white/5" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div
              className={`mb-5 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] uppercase ${
                state.status === 'success' && state.alerts.length === 0
                  ? 'border-emerald-200/15 bg-emerald-400/10 text-emerald-200'
                  : 'border-white/10 bg-white/[0.06] text-amber-200'
              }`}
            >
              {state.status === 'success' && state.alerts.length === 0 ? (
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              ) : (
                <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              Central de atenção
            </div>
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              {TITLE}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              {state.status === 'success' && state.alerts.length === 0
                ? 'Está tudo sob controle. Nenhuma garantia precisa da sua atenção agora.'
                : 'Veja rapidamente o que precisa da sua atenção para manter suas proteções em dia.'}
            </p>
          </div>
          {state.status === 'success' && (
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
              {state.alerts.length === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-300" aria-hidden="true" />
              ) : (
                <ShieldAlert className="h-5 w-5 text-amber-300" aria-hidden="true" />
              )}
              <div>
                <p className="text-2xl font-semibold leading-none text-white">
                  {state.alerts.length}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {state.alerts.length === 1 ? 'alerta ativo' : 'alertas ativos'}
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="relative mt-8 flex items-center gap-3 border-t border-white/10 pt-4 text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
          <span>
            Prioridades importantes, organizadas para você agir no momento certo.
          </span>
        </div>
      </section>

      {state.status === 'loading' && <AlertsSkeleton />}

      {state.status === 'error' && (
        <AlertsErrorState message={state.message} onRetry={handleRetry} />
      )}

      {state.status === 'success' &&
        (state.alerts.length === 0 ? (
          <AlertsEmptyState />
        ) : (
          <div className="space-y-8">
            {expiringAlerts.length > 0 && (
              <section aria-label="Vencendo em breve" className="space-y-4">
                <div className="flex items-end justify-between gap-4 px-1">
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.16em] text-amber-700 uppercase">
                      Atenção necessária
                    </p>
                    <h3 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-slate-950">
                      Vencendo em breve
                    </h3>
                  </div>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-600/15">
                    {expiringAlerts.length}
                  </span>
                </div>
                <div className="space-y-4">
                  {expiringAlerts.map((alert) => (
                    <AlertCard key={alert.id} alert={alert} />
                  ))}
                </div>
              </section>
            )}

            {expiredAlerts.length > 0 && (
              <section aria-label="Garantias expiradas" className="space-y-4">
                <div className="flex items-end justify-between gap-4 px-1">
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.16em] text-red-700 uppercase">
                      Prioridade crítica
                    </p>
                    <h3 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-slate-950">
                      Garantias expiradas
                    </h3>
                  </div>
                  <span className="rounded-full bg-red-50 px-2.5 py-1 text-xs font-bold text-red-800 ring-1 ring-red-600/15">
                    {expiredAlerts.length}
                  </span>
                </div>
                <div className="space-y-4">
                  {expiredAlerts.map((alert) => (
                    <AlertCard key={alert.id} alert={alert} />
                  ))}
                </div>
              </section>
            )}
          </div>
        ))}
    </div>
  )
}
