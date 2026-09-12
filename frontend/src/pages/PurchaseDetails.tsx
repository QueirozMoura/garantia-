import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { ShoppingBag, ArrowLeft } from 'lucide-react'
import { PurchaseDetailsSkeleton } from '../components/purchases/PurchaseDetailsSkeleton.tsx'
import { PurchaseNotFoundState } from '../components/purchases/PurchaseNotFoundState.tsx'
import { PurchasesErrorState } from '../components/purchases/PurchasesErrorState.tsx'
import { PurchaseWarrantySection } from '../components/purchases/PurchaseWarrantySection.tsx'
import { getPurchase, AuthenticationError, ApiError } from '../lib/api.ts'
import { useAuth } from '../contexts/auth-context.ts'
import { formatCurrencyBRL, formatDateBR } from '../lib/formatters.ts'
import type { Purchase } from '../types/purchase.ts'

type FetchState =
  | { status: 'loading' }
  | { status: 'notFound' }
  | { status: 'error'; message: string }
  | { status: 'success'; purchase: Purchase }

const FALLBACK_ERROR = 'Não foi possível carregar a compra. Tente novamente.'

export function PurchaseDetails() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [state, setState] = useState<FetchState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)

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
          // Token inválido/expirado: encerra a sessão global e volta ao login.
          setUser(null)
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
  }, [id, reloadKey, navigate, setUser])

  const handleRetry = useCallback(() => {
    setState({ status: 'loading' })
    setReloadKey((key) => key + 1)
  }, [])

  // Rota sem :id válido cai no mesmo estado de "não encontrada".
  const currentState: FetchState = id ? state : { status: 'notFound' }

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header do conteúdo */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            Detalhes da compra
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Informações registradas sobre este produto.
          </p>
        </div>

        <Link
          to="/purchases"
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Voltar para compras</span>
        </Link>
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
        <PurchaseDetailsContent purchase={currentState.purchase} />
      )}

      {currentState.status === 'success' && (
        <PurchaseWarrantySection purchaseId={currentState.purchase.id} />
      )}
    </div>
  )
}

function PurchaseDetailsContent({ purchase }: { purchase: Purchase }) {
  const brandModel = [purchase.brand, purchase.model].filter(Boolean).join(' ')
  const hasOptional = Boolean(
    purchase.brand || purchase.model || purchase.serialNumber || purchase.store,
  )

  return (
    <>
      {/* Card do produto */}
      <section className="rounded-xl border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <ShoppingBag className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-slate-900 sm:text-lg">
              {purchase.productName}
            </h3>
            {brandModel && (
              <p className="mt-0.5 truncate text-sm text-slate-500">{brandModel}</p>
            )}
          </div>
        </div>
      </section>

      {/* Grade de detalhes */}
      <section className="rounded-xl border-slate-200 bg-white p-5 sm:p-6">
        <h3 className="text-base font-semibold text-slate-900">Informações da compra</h3>
        <dl className="mt-5 grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <DetailItem label="Preço" value={formatCurrencyBRL(purchase.price)} emphasize />
          <DetailItem
            label="Data da compra"
            value={formatDateBR(purchase.purchaseDate)}
          />
          <DetailItem label="Categoria" value={purchase.category} />
          {hasOptional && (
            <>
              {purchase.brand && <DetailItem label="Marca" value={purchase.brand} />}
              {purchase.model && <DetailItem label="Modelo" value={purchase.model} />}
              {purchase.serialNumber && (
                <DetailItem label="Número de série" value={purchase.serialNumber} />
              )}
              {purchase.store && <DetailItem label="Loja" value={purchase.store} />}
            </>
          )}
        </dl>
      </section>
    </>
  )
}

interface DetailItemProps {
  label: string
  value: string
  emphasize?: boolean
}

function DetailItem({ label, value, emphasize = false }: DetailItemProps) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
        {label}
      </dt>
      <dd
        className={`mt-1 truncate ${
          emphasize ? 'text-lg font-bold text-slate-900' : 'text-sm text-slate-900'
        }`}
      >
        {value}
      </dd>
    </div>
  )
}
