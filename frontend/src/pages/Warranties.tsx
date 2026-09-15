import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { WarrantiesSummary } from '../components/warranties/WarrantiesSummary.tsx'
import { WarrantyCard } from '../components/warranties/WarrantyCard.tsx'
import { WarrantiesSkeleton } from '../components/warranties/WarrantiesSkeleton.tsx'
import { WarrantiesEmptyState } from '../components/warranties/WarrantiesEmptyState.tsx'
import { WarrantiesErrorState } from '../components/warranties/WarrantiesErrorState.tsx'
import { getWarranties, AuthenticationError, ApiError } from '../lib/api.ts'
import { useAuth } from '../contexts/auth-context.ts'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import type { WarrantyWithPurchase } from '../types/warranty.ts'

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; warranties: WarrantyWithPurchase[] }

const TITLE = 'Garantias'
const DESCRIPTION = 'Acompanhe o prazo de garantia dos seus produtos.'
const FALLBACK_ERROR = 'Não foi possível carregar suas garantias.'

export function Warranties() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [state, setState] = useState<FetchState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let isActive = true
    const load = async () => {
      try {
        const warranties = await getWarranties()
        if (isActive) setState({ status: 'success', warranties })
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
      <PageHeader title={TITLE} description={DESCRIPTION} />

      {state.status === 'loading' && <WarrantiesSkeleton />}

      {state.status === 'error' && (
        <WarrantiesErrorState message={state.message} onRetry={handleRetry} />
      )}

      {state.status === 'success' &&
        (state.warranties.length === 0 ? (
          <WarrantiesEmptyState />
        ) : (
          <>
            <WarrantiesSummary warranties={state.warranties} />

            <section aria-label="Lista de garantias" className="space-y-4">
              {state.warranties.map((warranty) => (
                <WarrantyCard key={warranty.id} warranty={warranty} />
              ))}
            </section>
          </>
        ))}
    </div>
  )
}
