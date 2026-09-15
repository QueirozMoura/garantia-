import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileStack, LockKeyhole, ShieldCheck } from 'lucide-react'
import { DocumentCard } from '../components/documents/DocumentCard.tsx'
import { DocumentsSkeleton } from '../components/documents/DocumentsSkeleton.tsx'
import { DocumentsEmptyState } from '../components/documents/DocumentsEmptyState.tsx'
import { DocumentsErrorState } from '../components/documents/DocumentsErrorState.tsx'
import { DocumentsToolbar } from '../components/documents/DocumentsToolbar.tsx'
import { DocumentsNoResultsState } from '../components/documents/DocumentsNoResultsState.tsx'
import {
  EMPTY_FILTERS,
  applyDocumentFilters,
  hasActiveFilters,
  type DocumentFilters,
} from '../components/documents/document-filters.ts'
import { getDocuments, AuthenticationError, ApiError } from '../lib/api.ts'
import { useAuth } from '../contexts/auth-context.ts'
import type { DocumentWithPurchase } from '../types/document.ts'

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; documents: DocumentWithPurchase[] }

/** Referência estável para o estado "sem dados", evitando recriar o array. */
const EMPTY_DOCUMENTS: DocumentWithPurchase[] = []

const TITLE = 'Documentos'
const FALLBACK_ERROR = 'Não foi possível carregar seus documentos.'

export function Documents() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [state, setState] = useState<FetchState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  // Busca, filtros e ordenação vivem SOMENTE no estado local: nada vai para a
  // URL e nenhuma alteração dispara nova requisição (os dados já estão aqui).
  const [filters, setFilters] = useState<DocumentFilters>(EMPTY_FILTERS)

  const handleAuthError = useCallback(() => {
    // Token inválido/expirado: encerra a sessão global e volta ao login.
    setUser(null)
    navigate('/login', { replace: true })
  }, [navigate, setUser])

  useEffect(() => {
    let isActive = true
    const load = async () => {
      try {
        const documents = await getDocuments()
        if (isActive) setState({ status: 'success', documents })
      } catch (error) {
        if (!isActive) return
        if (error instanceof AuthenticationError) {
          handleAuthError()
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
  }, [reloadKey, handleAuthError])

  const handleRetry = useCallback(() => {
    setState({ status: 'loading' })
    setReloadKey((key) => key + 1)
  }, [])

  const handleDeleted = useCallback((documentId: string) => {
    setState((current) =>
      current.status === 'success'
        ? {
            status: 'success',
            documents: current.documents.filter((item) => item.id !== documentId),
          }
        : current,
    )
  }, [])

  // Lista completa recebida da API. Estável entre renderizações de busca/filtro
  // para que o `useMemo` abaixo só recalcule quando algo realmente muda.
  const allDocuments = state.status === 'success' ? state.documents : EMPTY_DOCUMENTS
  /** Resultado de busca + tipo + período + ordenação. Cópia, sem mutar. */
  const visibleDocuments = useMemo(
    () => applyDocumentFilters(allDocuments, filters),
    [allDocuments, filters],
  )

  const filtersActive = hasActiveFilters(filters)

  /** Atualiza um controle de cada vez, sempre em cima do estado anterior. */
  const handleFiltersChange = useCallback((patch: Partial<DocumentFilters>) => {
    setFilters((current) => ({ ...current, ...patch }))
  }, [])

  /** Restaura o padrão. Apenas estado local — sem navegação nem API. */
  const handleClearFilters = useCallback(() => setFilters(EMPTY_FILTERS), [])

  // Contador: "8 documentos" ou, com filtros ativos e resultado menor,
  // "3 de 8 documentos". O total é o número de documentos carregados.
  const totalCount = allDocuments.length
  const visibleCount = visibleDocuments.length
  const isFiltered = filtersActive && visibleCount !== totalCount
  const counterLabel = isFiltered
    ? `${visibleCount} de ${totalCount} ${totalCount === 1 ? 'documento' : 'documentos'}`
    : `${visibleCount} ${visibleCount === 1 ? 'documento' : 'documentos'}`

  return (
    <div className="space-y-8 sm:space-y-10">
      <section className="relative isolate overflow-hidden rounded-[2rem] border border-slate-800 bg-slate-950 px-6 py-7 text-white shadow-[0_24px_60px_-38px_rgb(15_23_42/0.75)] sm:px-9 sm:py-9">
        <div className="surface-grid absolute inset-0 -z-10 opacity-20 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="absolute -right-20 -top-24 -z-10 h-72 w-72 rounded-full bg-blue-400/10 blur-3xl" />
        <div className="absolute bottom-[-5rem] right-[18%] -z-10 h-40 w-40 rounded-full border border-blue-300/10" />
        <div className="absolute bottom-[-6rem] right-[10%] -z-10 h-56 w-56 rounded-full border border-white/5" />

        <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold tracking-[0.18em] text-blue-200 uppercase">
              <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
              Cofre digital
            </div>
            <h2 className="text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              {TITLE}
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-300 sm:text-base">
              Todos os comprovantes, notas e documentos das suas compras em um só lugar.
            </p>
          </div>
          {state.status === 'success' && (
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3">
              <FileStack className="h-5 w-5 text-blue-300" aria-hidden="true" />
              <div>
                <p className="text-2xl font-semibold leading-none text-white">
                  {state.documents.length}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {state.documents.length === 1
                    ? 'documento protegido'
                    : 'documentos protegidos'}
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="relative mt-8 flex items-center gap-3 border-t border-white/10 pt-4 text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden="true" />
          <span>Encontre rapidamente os arquivos que comprovam cada compra.</span>
        </div>
      </section>

      {state.status === 'loading' && <DocumentsSkeleton />}

      {state.status === 'error' && (
        <DocumentsErrorState message={state.message} onRetry={handleRetry} />
      )}

      {/* Os controles só aparecem depois que os dados chegaram: durante o
          loading mostra-se apenas o skeleton, e no erro só o Error State. */}
      {state.status === 'success' && state.documents.length > 0 && (
        <DocumentsToolbar
          filters={filters}
          onChange={handleFiltersChange}
          hasActiveFilters={filtersActive}
          onClear={handleClearFilters}
        />
      )}

      {state.status === 'success' &&
        (state.documents.length === 0 ? (
          // Nenhum documento cadastrado: mantém o Empty State original.
          <DocumentsEmptyState />
        ) : visibleDocuments.length === 0 ? (
          // Existem documentos, mas nada corresponde à busca/filtros.
          <DocumentsNoResultsState onClear={handleClearFilters} />
        ) : (
          <section aria-label="Biblioteca de documentos" className="space-y-4">
            <div className="flex items-end justify-between gap-4 px-1">
              <div>
                <p className="text-[10px] font-bold tracking-[0.16em] text-blue-700 uppercase">
                  Arquivo pessoal
                </p>
                <h3 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-slate-950">
                  Sua documentoteca
                </h3>
              </div>
              <p aria-live="polite" className="text-xs font-medium text-slate-400">
                {counterLabel}
              </p>
            </div>
            {visibleDocuments.map((document) => (
              <DocumentCard
                key={document.id}
                document={document}
                onDeleted={handleDeleted}
                onAuthError={handleAuthError}
              />
            ))}
          </section>
        ))}
    </div>
  )
}
