import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Plus, CheckCircle } from 'lucide-react'
import { PurchasesList } from '../components/purchases/PurchasesList.tsx'
import { PurchasesSkeleton } from '../components/purchases/PurchasesSkeleton.tsx'
import { PurchasesEmptyState } from '../components/purchases/PurchasesEmptyState.tsx'
import { PurchasesErrorState } from '../components/purchases/PurchasesErrorState.tsx'
import { PurchasesToolbar } from '../components/purchases/PurchasesToolbar.tsx'
import { PurchasesNoResultsState } from '../components/purchases/PurchasesNoResultsState.tsx'
import {
  EMPTY_FILTERS,
  applyPurchaseFilters,
  getAvailableCategories,
  hasActiveFilters,
  type PurchaseFilters,
} from '../components/purchases/purchase-filters.ts'
import { getPurchases, AuthenticationError, ApiError } from '../lib/api.ts'
import { useAuth } from '../contexts/auth-context.ts'
import type { Purchase } from '../types/purchase.ts'

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; purchases: Purchase[] }

/** Referência estável para o estado "sem dados", evitando recriar o array. */
const EMPTY_PURCHASES: Purchase[] = []

const TITLE = 'Minhas compras'
const DESCRIPTION =
  'Visualize as compras que você cadastrou e acompanhe as garantias de cada produto.'
const FALLBACK_ERROR = 'Não foi possível carregar suas compras. Tente novamente.'

export function Purchases() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setUser } = useAuth()
  const [state, setState] = useState<FetchState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  // Busca, filtros e ordenação vivem SOMENTE no estado local: nada vai para a
  // URL e nenhuma alteração dispara nova requisição (os dados já estão aqui).
  const [filters, setFilters] = useState<PurchaseFilters>(EMPTY_FILTERS)
  // Flash message vinda de outra tela (ex.: exclusão de compra).
  const flashMessage =
    (location.state as { flashMessage?: string } | null)?.flashMessage ?? null

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

  // Lista completa recebida da API. Estável entre renderizações de busca/filtro
  // para que os `useMemo` abaixo só recalculem quando algo realmente muda.
  const allPurchases = state.status === 'success' ? state.purchases : EMPTY_PURCHASES
  /** Categorias derivadas dos dados carregados — sem lista fixa no código. */
  const categories = useMemo(() => getAvailableCategories(allPurchases), [allPurchases])

  /** Resultado de busca + filtro por categoria + ordenação. Cópia, sem mutar. */
  const visiblePurchases = useMemo(
    () => applyPurchaseFilters(allPurchases, filters),
    [allPurchases, filters],
  )

  const filtersActive = hasActiveFilters(filters)

  /** Atualiza um controle de cada vez, sempre em cima do estado anterior. */
  const handleFiltersChange = useCallback((patch: Partial<PurchaseFilters>) => {
    setFilters((current) => ({ ...current, ...patch }))
  }, [])

  /** Restaura o padrão. Apenas estado local — sem navegação nem API. */
  const handleClearFilters = useCallback(() => setFilters(EMPTY_FILTERS), [])

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

        <button
          type="button"
          onClick={() => navigate('/purchases/new')}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          <span>Adicionar compra</span>
        </button>
      </section>

      {flashMessage && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-lg border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800"
        >
          <CheckCircle className="h-4 w-4 shrink-0 translate-y-0.5" aria-hidden="true" />
          <span>{flashMessage}</span>
        </div>
      )}

      {state.status === 'loading' && <PurchasesSkeleton />}

      {state.status === 'error' && (
        <PurchasesErrorState message={state.message} onRetry={handleRetry} />
      )}

      {/* Os controles só aparecem depois que os dados chegaram: durante o
          loading mostra-se apenas o skeleton, e no erro só o Error State. */}
      {state.status === 'success' && state.purchases.length > 0 && (
        <PurchasesToolbar
          filters={filters}
          categories={categories}
          onChange={handleFiltersChange}
          hasActiveFilters={filtersActive}
          onClear={handleClearFilters}
        />
      )}

      {state.status === 'success' &&
        (state.purchases.length === 0 ? (
          // Nenhuma compra cadastrada: mantém o Empty State original.
          <PurchasesEmptyState />
        ) : visiblePurchases.length === 0 ? (
          // Existem compras, mas nada corresponde à busca/filtros.
          <PurchasesNoResultsState onClear={handleClearFilters} />
        ) : (
          <PurchasesList purchases={visiblePurchases} totalCount={allPurchases.length} />
        ))}
    </div>
  )
}
