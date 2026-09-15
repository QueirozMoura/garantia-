import { useCallback, useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCard } from '../components/alerts/AlertCard.tsx'
import { AlertsSkeleton } from '../components/alerts/AlertsSkeleton.tsx'
import { AlertsEmptyState } from '../components/alerts/AlertsEmptyState.tsx'
import { AlertsErrorState } from '../components/alerts/AlertsErrorState.tsx'
import { getAlerts, AuthenticationError, ApiError } from '../lib/api.ts'
import { useAuth } from '../contexts/auth-context.ts'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { SectionHeader } from '../components/ui/SectionHeader.tsx'
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

  const expiringAlerts = useMemo(() => {
    if (state.status !== 'success') return []
    return state.alerts.filter((a) => a.type === 'WARRANTY_EXPIRING')
  }, [state])

  const expiredAlerts = useMemo(() => {
    if (state.status !== 'success') return []
    return state.alerts.filter((a) => a.type === 'WARRANTY_EXPIRED')
  }, [state])

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header do conteúdo */}
      <PageHeader title={TITLE} description={DESCRIPTION} />

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
                <SectionHeader title="Vencendo em breve" />
                <div className="space-y-4">
                  {expiringAlerts.map((alert) => (
                    <AlertCard key={alert.id} alert={alert} />
                  ))}
                </div>
              </section>
            )}

            {expiredAlerts.length > 0 && (
              <section aria-label="Garantias expiradas" className="space-y-4">
                <SectionHeader title="Garantias expiradas" />
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
