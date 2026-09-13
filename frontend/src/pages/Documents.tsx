import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
const DESCRIPTION =
  'Todas as notas fiscais, recibos e comprovantes das suas compras em um só lugar.'
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
          <section aria-label="Lista de documentos" className="space-y-4">
            <p aria-live="polite" className="text-xs font-medium text-slate-400">
              {counterLabel}
            </p>
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
