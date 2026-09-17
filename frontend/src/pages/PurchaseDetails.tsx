import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, Link, useLocation } from 'react-router-dom'
import { ShoppingBag, ArrowLeft, Pencil, Trash2 } from 'lucide-react'
import { PurchaseDetailsSkeleton } from '../components/purchases/PurchaseDetailsSkeleton.tsx'
import { PurchaseNotFoundState } from '../components/purchases/PurchaseNotFoundState.tsx'
import { PurchasesErrorState } from '../components/purchases/PurchasesErrorState.tsx'
import { PurchaseWarrantySection } from '../components/purchases/PurchaseWarrantySection.tsx'
import { PurchaseAssistanceSection } from '../components/purchases/PurchaseAssistanceSection.tsx'
import { PurchaseDocumentsSection } from '../components/purchases/PurchaseDocumentsSection.tsx'
import { DeletePurchaseDialog } from '../components/purchases/DeletePurchaseDialog.tsx'
import { getPurchase, deletePurchase, AuthenticationError, ApiError } from '../lib/api.ts'
import { useAuth } from '../contexts/auth-context.ts'
import { formatCurrencyBRL, formatDateBR } from '../lib/formatters.ts'
import type { Purchase } from '../types/purchase.ts'
import type { DocumentExtractionConfirmationResponse } from '../types/document.ts'
import { PageHeader, FeedbackMessage, Button, Card } from '../components/ui'

type FetchState =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'error'; message: string }
  | { status: 'success'; purchase: Purchase }

const FALLBACK_ERROR = 'Não foi possível carregar a compra. Tente novamente.'
const FALLBACK_DELETE_ERROR = 'Não foi possível excluir a compra. Tente novamente.'

/** Mensagens amigáveis por status HTTP do DELETE. */
const deleteErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'Você não tem permissão para excluir esta compra.'
    if (error.status === 404) return 'Esta compra não foi encontrada.'
    // Compra com garantia: o backend responde 400 PURCHASE_HAS_DEPENDENCIES.
    if (error.status === 400 && error.code === 'PURCHASE_HAS_DEPENDENCIES') {
      return 'Esta compra possui uma garantia e não pode ser excluída enquanto ela existir.'
    }
  }
  // 400/500 e demais erros caem na mensagem genérica amigável.
  return FALLBACK_DELETE_ERROR
}

export function PurchaseDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const { expireSession } = useAuth()
  const [state, setState] = useState<FetchState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  // Incrementado após uma extração confirmada para recarregar a seção de garantia.
  const [warrantyReloadKey, setWarrantyReloadKey] = useState(0)
  // Mensagem de sucesso vinda da edição (flash) ou da extração confirmada.
  const flashMessage =
    (location.state as { flashMessage?: string } | null)?.flashMessage ?? null
  const [successMessage, setSuccessMessage] = useState<string | null>(flashMessage)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

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
          // Token inválido/expirado: consolida o estado visitante e volta ao login.
          expireSession()
          navigate('/login', { replace: true })
          return
        }
        // 404 (não existe) e 403 (outro usuário): não expõe dados, mostra
        // o mesmo estado "não encontrada" — o backend já esconde a existência.
        if (error instanceof ApiError && (error.status === 404 || error.status === 403)) {
          setState({ status: 'notFound' })
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
  }, [id, reloadKey, navigate, expireSession])

  const handleRetry = useCallback(() => {
    setState({ status: 'loading' })
    setReloadKey((key) => key + 1)
  }, [])

  /**
   * Sessão inválida/expirada (401) detectada por uma seção interna (ex.: a
   * assistência): encerra a sessão global e volta ao login, como no load.
   */
  const handleAuthError = useCallback(() => {
    expireSession()
    navigate('/login', { replace: true })
  }, [navigate, expireSession])

  /**
   * Aplica na tela o resultado da confirmação de uma extração, usando os dados
   * já atualizados retornados pelo backend (sem recalcular nada aqui).
   */
  const handleExtractionApplied = useCallback(
    (result: DocumentExtractionConfirmationResponse) => {
      setState({ status: 'success', purchase: result.purchase })
      setSuccessMessage('Dados da nota aplicados à compra.')
      // A garantia é carregada pela própria seção; força um novo fetch.
      setWarrantyReloadKey((key) => key + 1)
    },
    [],
  )

  /** Executa a exclusão somente quando o usuário confirma no modal. */
  const handleDelete = useCallback(async () => {
    if (!id || isDeleting) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await deletePurchase(id)
      // Sucesso: fecha o modal e volta para a lista com flash message.
      setIsDeleteOpen(false)
      navigate('/purchases', {
        replace: true,
        state: { flashMessage: 'Compra excluída com sucesso.' },
      })
    } catch (error) {
      if (error instanceof AuthenticationError) {
        // Token inválido/expirado: consolida o estado visitante e volta ao login.
        expireSession()
        navigate('/login', { replace: true })
        return
      }
      // Mantém o modal aberto para o usuário tentar novamente.
      setDeleteError(deleteErrorMessage(error))
      setIsDeleting(false)
    }
  }, [id, isDeleting, navigate, expireSession])

  // Rota sem :id válido cai no mesmo estado de "não encontrada".
  const currentState: FetchState = id ? state : { status: 'notFound' }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header do conteúdo */}
      <PageHeader
        title="Detalhes da compra"
        description={
          currentState.status === 'success'
            ? currentState.purchase.category ||
              'Informações registradas sobre este produto.'
            : 'Informações registradas sobre este produto.'
        }
        actions={
          <div className="flex flex-wrap items-center gap-3">
            <Button
              as={Link}
              to="/purchases"
              variant="outline"
              leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden="true" />}
            >
              Voltar para compras
            </Button>

            {currentState.status === 'success' && (
              <Button
                as={Link}
                to={`/purchases/${currentState.purchase.id}/edit`}
                variant="primary"
                leftIcon={<Pencil className="h-4 w-4" aria-hidden="true" />}
              >
                Editar compra
              </Button>
            )}

            {currentState.status === 'success' && (
              <Button
                onClick={() => {
                  setDeleteError(null)
                  setIsDeleteOpen(true)
                }}
                variant="danger"
                leftIcon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
              >
                Excluir compra
              </Button>
            )}
          </div>
        }
      />

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

      {currentState.status === 'success' && successMessage && (
        <FeedbackMessage variant="success" message={successMessage} />
      )}

      {currentState.status === 'success' && (
        <PurchaseDetailsContent purchase={currentState.purchase} />
      )}

      {currentState.status === 'success' && (
        <PurchaseWarrantySection
          key={warrantyReloadKey}
          purchaseId={currentState.purchase.id}
        />
      )}

      {currentState.status === 'success' && (
        <PurchaseAssistanceSection
          purchaseId={currentState.purchase.id}
          onAuthError={handleAuthError}
        />
      )}

      {currentState.status === 'success' && (
        <PurchaseDocumentsSection
          purchaseId={currentState.purchase.id}
          onPurchaseUpdated={handleExtractionApplied}
        />
      )}

      {currentState.status === 'success' && isDeleteOpen && (
        <DeletePurchaseDialog
          purchase={currentState.purchase}
          onClose={() => setIsDeleteOpen(false)}
          onConfirm={handleDelete}
          isDeleting={isDeleting}
          errorMessage={deleteError}
        />
      )}
    </div>
  )
}

function PurchaseDetailsContent({ purchase }: { purchase: Purchase }) {
  const brandModel = [purchase.brand, purchase.model].filter(Boolean).join(' ')

  return (
    <Card className="surface-grid relative overflow-hidden border-slate-200/80 bg-white/90 p-0 shadow-[0_14px_40px_-28px_rgb(15_23_42/0.55)]">
      <div className="relative flex flex-col gap-6 border-b border-slate-100 bg-gradient-to-br from-white via-white/90 to-emerald-50/45 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
        <div className="flex items-start gap-5">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-900/10 ring-4 ring-emerald-100">
            <ShoppingBag className="h-8 w-8" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="mb-1 text-[10px] font-bold tracking-[0.18em] text-emerald-700 uppercase">
              Compra protegida
            </p>
            <h2 className="text-2xl font-bold tracking-[-0.03em] text-slate-950">
              {purchase.productName}
            </h2>
            {brandModel && (
              <p className="mt-1 text-sm font-medium text-slate-500">{brandModel}</p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-600/15">
                {purchase.category}
              </span>
              <span className="inline-flex items-center rounded-full bg-white/80 px-2.5 py-0.5 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                Importado por NF-e
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-start rounded-2xl border border-emerald-100 bg-white/90 px-5 py-4 shadow-sm sm:items-end">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Valor da compra
          </span>
          <span className="mt-1 text-4xl font-extrabold tracking-tight text-emerald-600">
            {formatCurrencyBRL(purchase.price)}
          </span>
        </div>
      </div>

      <section aria-labelledby="purchase-info-title">
        <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-2 md:divide-y-0 md:divide-x">
          <div className="p-6 sm:p-8">
            <h3 className="mb-6 flex items-center text-sm font-semibold uppercase tracking-wider text-slate-900">
              <span className="mr-2 h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgb(16_185_129/0.12)]" />
              <span id="purchase-info-title">Informações da compra</span>
            </h3>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-slate-500">Valor</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">
                  {formatCurrencyBRL(purchase.price)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Data da compra</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">
                  {formatDateBR(purchase.purchaseDate)}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Loja</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">
                  {purchase.store || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Categoria</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">
                  {purchase.category || '-'}
                </dd>
              </div>
            </dl>
          </div>

          <div className="bg-slate-50/30 p-6 sm:p-8">
            <h3 className="mb-6 flex items-center text-sm font-semibold uppercase tracking-wider text-slate-900">
              <span className="mr-2 h-2 w-2 rounded-full bg-sky-500 shadow-[0_0_0_4px_rgb(14_165_233/0.12)]" />
              Informações do Produto
            </h3>
            <dl className="grid grid-cols-1 gap-y-6 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium text-slate-500">Marca</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">
                  {purchase.brand || '-'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium text-slate-500">Modelo</dt>
                <dd className="mt-1 text-sm font-semibold text-slate-900">
                  {purchase.model || '-'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium text-slate-500">Número de série</dt>
                <dd className="mt-1 font-mono text-sm font-medium text-slate-700">
                  {purchase.serialNumber || '-'}
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>
    </Card>
  )
}
