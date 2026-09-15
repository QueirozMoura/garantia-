import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { CheckCircle, Package, Plus, ShieldCheck } from 'lucide-react'
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
    <div className="space-y-8 sm:space-y-10">
      <section className="relative isolate overflow-hidden rounded-[2rem] border border-slate-200 bg-white px-6 py-7 shadow-[0_20px_48px_-36px_rgb(15_23_42/0.55)] sm:px-9 sm:py-9">
        <div className="surface-grid absolute inset-0 -z-10 opacity-40 [mask-image:linear-gradient(110deg,black,transparent_75%)]" />
        <div className="absolute -right-16 -top-24 -z-10 h-64 w-64 rounded-full bg-emerald-50" />
        <div className="absolute right-16 top-10 -z-10 h-28 w-28 rounded-full border border-emerald-100" />
        <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-slate-950 px-3 py-1.5 text-[10px] font-bold tracking-[0.17em] text-emerald-200 uppercase">
              <Package className="h-3.5 w-3.5" aria-hidden="true" />
              Biblioteca pessoal
            </div>
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
              {TITLE}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-base">
              Tenha todas as suas compras, produtos e garantias organizados em um só
              lugar.
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/purchases/new')}
            className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_-16px_rgb(5_150_105/0.85)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-emerald-500 hover:shadow-[0_16px_28px_-16px_rgb(5_150_105/0.85)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            <span>Adicionar compra</span>
          </button>
        </div>
        {state.status === 'success' && (
          <div className="relative mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
            <span className="inline-flex items-center gap-2">
              <Package className="h-4 w-4 text-emerald-600" aria-hidden="true" />
              <strong className="font-semibold text-slate-700">
                {state.purchases.length}
              </strong>{' '}
              {state.purchases.length === 1 ? 'compra cadastrada' : 'compras cadastradas'}
            </span>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-slate-400" aria-hidden="true" />
              Histórico organizado para consulta rápida
            </span>
          </div>
        )}
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
