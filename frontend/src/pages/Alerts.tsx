import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
const DESCRIPTION = 'Fique de olho nas garantias que precisam da sua atenção.'
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

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header do conteúdo */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {TITLE}
          </h2>
          <p className="mt-1 text-sm text-slate-500">{DESCRIPTION}</p>
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
          <section aria-label="Lista de alertas" className="space-y-4">
            {state.alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </section>
        ))}
    </div>
  )
}
