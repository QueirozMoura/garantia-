import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { PurchasesList } from '../components/purchases/PurchasesList.tsx'
import { PurchasesSkeleton } from '../components/purchases/PurchasesSkeleton.tsx'
import { PurchasesEmptyState } from '../components/purchases/PurchasesEmptyState.tsx'
import { PurchasesErrorState } from '../components/purchases/PurchasesErrorState.tsx'
import { getPurchases, AuthenticationError, ApiError } from '../lib/api.ts'
import { useAuth } from '../contexts/auth-context.ts'
import type { Purchase } from '../types/purchase.ts'

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; purchases: Purchase[] }

const TITLE = 'Minhas compras'
const DESCRIPTION =
  'Visualize as compras que você cadastrou e acompanhe as garantias de cada produto.'
const FALLBACK_ERROR = 'Não foi possível carregar suas compras. Tente novamente.'

export function Purchases() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [state, setState] = useState<FetchState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let isActive = true
    const load = async () => {
      try {
        const purchases = await getPurchases()
        if (isActive) setState({ status: 'success', purchases })
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

        {/* Botão visual: a criação de compras será implementada na próxima etapa. */}
        <button
          type="button"
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Adicionar compra</span>
        </button>
      </section>

      {state.status === 'loading' && <PurchasesSkeleton />}

      {state.status === 'error' && (
        <PurchasesErrorState message={state.message} onRetry={handleRetry} />
      )}

      {state.status === 'success' &&
        (state.purchases.length === 0 ? (
          <PurchasesEmptyState />
        ) : (
          <PurchasesList purchases={state.purchases} />
        ))}
    </div>
  )
}
