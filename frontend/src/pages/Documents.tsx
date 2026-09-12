import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DocumentCard } from '../components/documents/DocumentCard.tsx'
import { DocumentsSkeleton } from '../components/documents/DocumentsSkeleton.tsx'
import { DocumentsEmptyState } from '../components/documents/DocumentsEmptyState.tsx'
import { DocumentsErrorState } from '../components/documents/DocumentsErrorState.tsx'
import { getDocuments, AuthenticationError, ApiError } from '../lib/api.ts'
import { useAuth } from '../contexts/auth-context.ts'
import type { DocumentWithPurchase } from '../types/document.ts'

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; documents: DocumentWithPurchase[] }

const TITLE = 'Documentos'
const DESCRIPTION =
  'Todas as notas fiscais, recibos e comprovantes das suas compras em um só lugar.'
const FALLBACK_ERROR = 'Não foi possível carregar seus documentos.'

export function Documents() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [state, setState] = useState<FetchState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

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

      {state.status === 'success' &&
        (state.documents.length === 0 ? (
          <DocumentsEmptyState />
        ) : (
          <section aria-label="Lista de documentos" className="space-y-4">
            {state.documents.map((document) => (
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
