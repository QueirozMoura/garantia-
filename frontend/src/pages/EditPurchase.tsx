import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { PurchaseForm } from '../components/purchases/PurchaseForm.tsx'
import type { PurchaseFormFields } from '../components/purchases/purchase-form.ts'
import { PurchaseDetailsSkeleton } from '../components/purchases/PurchaseDetailsSkeleton.tsx'
import { PurchaseNotFoundState } from '../components/purchases/PurchaseNotFoundState.tsx'
import { PurchasesErrorState } from '../components/purchases/PurchasesErrorState.tsx'
import { getPurchase, updatePurchase, AuthenticationError, ApiError } from '../lib/api.ts'
import { useAuth } from '../contexts/auth-context.ts'
import type { CreatePurchaseInput, Purchase } from '../types/purchase.ts'

type LoadState =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'error'; message: string }
  | { status: 'success'; purchase: Purchase }

const FALLBACK_LOAD_ERROR = 'Não foi possível carregar a compra. Tente novamente.'
const FALLBACK_SAVE_ERROR = 'Não foi possível atualizar a compra. Tente novamente.'

/** Mensagens amigáveis por status HTTP do PUT. */
const saveErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 400) return 'Verifique os dados informados.'
    if (error.status === 404) return 'Esta compra não foi encontrada.'
  }
  return FALLBACK_SAVE_ERROR
}

/** Converte os dados atuais da compra para os campos do formulário. */
const purchaseToFields = (purchase: Purchase): PurchaseFormFields => ({
  productName: purchase.productName,
  brand: purchase.brand ?? '',
  model: purchase.model ?? '',
  serialNumber: purchase.serialNumber ?? '',
  store: purchase.store ?? '',
  purchaseDate: purchase.purchaseDate.slice(0, 10),
  price: purchase.price,
  category: purchase.category,
})

export function EditPurchase() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { expireSession } = useAuth()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleAuthError = useCallback(() => {
    // Token inválido/expirado: consolida o estado visitante e volta ao login.
    expireSession()
    navigate('/login', { replace: true })
  }, [navigate, expireSession])

  useEffect(() => {
    if (!id) return
    let isActive = true
    const load = async () => {
      try {
        const purchase = await getPurchase(id)
        if (isActive) setState({ status: 'success', purchase })
      } catch (error) {
        if (!isActive) return
        if (error instanceof AuthenticationError) {
          handleAuthError()
          return
        }
        // 404 (não existe) e 403 (outro usuário): mesmo estado "não encontrada".
        if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
          setState({ status: 'notFound' })
          return
        }
        const message = error instanceof ApiError ? error.message : FALLBACK_LOAD_ERROR
        setState({ status: 'error', message })
      }
    }

    void load()

    return () => {
      isActive = false
    }
  }, [id, reloadKey, handleAuthError])

  const handleRetry = useCallback(() => {
    setState({ status: 'loading' })
    setReloadKey((key) => key + 1)
  }, [])

  const handleSubmit = useCallback(
    async (payload: CreatePurchaseInput) => {
      if (!id || isSubmitting) return
      setIsSubmitting(true)
      setFormError(null)
      try {
        // Usa o objeto retornado pelo backend para a tela de detalhes.
        const updated = await updatePurchase(id, payload)
        navigate(`/purchases/${updated.id}`, {
          replace: true,
          state: { flashMessage: 'Compra atualizada com sucesso.' },
        })
      } catch (error) {
        if (error instanceof AuthenticationError) {
          handleAuthError()
          return
        }
        // Mantém os valores digitados e permite tentar de novo.
        setFormError(saveErrorMessage(error))
        setIsSubmitting(false)
      }
    },
    [id, isSubmitting, navigate, handleAuthError],
  )

  // Rota sem :id válido cai no mesmo estado de "não encontrada".
  const currentState: LoadState = id ? state : { status: 'notFound' }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header do conteúdo */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-2 text-[10px] font-bold tracking-[0.18em] text-emerald-600 uppercase">
            Atualização segura
          </p>
          <h2 className="text-2xl font-bold tracking-[-0.03em] text-slate-950 sm:text-3xl">
            Editar compra
          </h2>
          <p className="mt-1 text-sm text-slate-500">Atualize os dados desta compra.</p>
        </div>

        <button
          type="button"
          onClick={() => navigate(`/purchases/${id ?? ''}`)}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Voltar</span>
        </button>
      </section>

      {currentState.status === 'loading' && <PurchaseDetailsSkeleton />}

      {currentState.status === 'notFound' && <PurchaseNotFoundState />}

      {currentState.status === 'error' && (
        <PurchasesErrorState
          message={currentState.message}
          onRetry={handleRetry}
          title="Não foi possível carregar a compra"
          fallbackMessage="Ocorreu uma instabilidade momentânea ao buscar esta compra. Tente novamente."
        />
      )}

      {currentState.status === 'success' && (
        <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_12px_36px_-28px_rgb(15_23_42/0.55)] sm:p-6">
          <PurchaseForm
            initialFields={purchaseToFields(currentState.purchase)}
            submitLabel="Salvar alterações"
            formError={formError}
            isSubmitting={isSubmitting}
            onSubmit={handleSubmit}
            onCancel={() => navigate(`/purchases/${currentState.purchase.id}`)}
          />
        </div>
      )}
    </div>
  )
}
