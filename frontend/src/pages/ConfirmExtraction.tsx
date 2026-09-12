import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, CheckCircle2, Loader2, SearchX } from 'lucide-react'
import { confirmDocumentExtraction, AuthenticationError, ApiError } from '../lib/api.ts'
import { useAuth } from '../contexts/auth-context.ts'
import { formatCurrencyBRL, formatDateBR } from '../lib/formatters.ts'
import { NOT_IDENTIFIED } from '../components/purchases/purchase-document.ts'
import { validatePriceValue } from '../components/purchases/purchase-form.ts'
import { PurchaseFlowStepper } from '../components/purchases/PurchaseFlowStepper.tsx'
import type { DocumentExtraction } from '../types/document.ts'

/**
 * Dados transportados via location.state desde a etapa de revisão (Etapa 3).
 * `extraction` são os dados revisados; `invoiceNumber` é somente para exibição.
 */
interface ConfirmationState {
  purchaseId?: string
  documentId?: string
  extraction?: DocumentExtraction
  invoiceNumber?: string | null
}

const FALLBACK_ERROR = 'Não foi possível aplicar os dados. Tente novamente.'

/**
 * Mensagens amigáveis por status HTTP do PATCH. Nunca expõe stack, Prisma,
 * SQL, Axios/fetch, nomes de exceção nem a mensagem crua do backend (que pode
 * ser "Something went wrong" / "Validation failed").
 */
const confirmErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.'
    }
    if (error.status === 400) {
      return 'Não foi possível aplicar os dados. Verifique as informações e tente novamente.'
    }
    if (error.status === 403) {
      return 'Você não tem permissão para atualizar esta compra.'
    }
    if (error.status === 404) {
      return 'Este documento não está mais disponível.'
    }
  }
  return FALLBACK_ERROR
}

/**
 * Confirmação final dos dados revisados da nota fiscal.
 *
 * Ao confirmar, envia SOMENTE `PATCH /documents/:documentId/extraction` — a
 * compra já existe (criada na Etapa 1) e a garantia é responsabilidade do
 * backend. Não cria compra, não faz upload e não chama /extract.
 */
export function ConfirmExtraction() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setUser } = useAuth()

  const state = (location.state as ConfirmationState | null) ?? null
  const purchaseId = state?.purchaseId
  const documentId = state?.documentId
  const reviewed = state?.extraction ?? null
  const invoiceNumber = state?.invoiceNumber ?? null

  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Guarda síncrona contra duplo clique/duas requisições PATCH simultâneas.
  const isConfirmingRef = useRef(false)
  const errorRef = useRef<HTMLDivElement>(null)

  // Após um erro, leva o foco ao alerta para leitores de tela e teclado.
  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  const summary = useMemo(() => {
    if (!reviewed) return []
    return [
      { label: 'Produto', value: reviewed.productName ?? NOT_IDENTIFIED },
      { label: 'Marca', value: reviewed.brand ?? 'Não informado' },
      { label: 'Modelo', value: reviewed.model ?? 'Não informado' },
      {
        label: 'Data da compra',
        value: reviewed.purchaseDate
          ? formatDateBR(reviewed.purchaseDate)
          : 'Não informado',
      },
      {
        label: 'Valor',
        value:
          reviewed.price === null ? 'Não informado' : formatCurrencyBRL(reviewed.price),
      },
      { label: 'Loja', value: reviewed.store ?? 'Não informado' },
      {
        label: 'Garantia',
        value:
          reviewed.warrantyMonths === null || reviewed.warrantyMonths === undefined
            ? 'Não informado'
            : `${reviewed.warrantyMonths} meses`,
      },
    ]
  }, [reviewed])

  // Caso 1: faltam os dados essenciais (acesso direto sem location.state).
  if (!purchaseId || !documentId || !reviewed) {
    return (
      <div className="space-y-6 sm:space-y-8">
        <section className="rounded-2xl border-slate-200 bg-white p-8 text-center sm:p-12">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
            <SearchX className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-slate-900 sm:text-lg">
            Não foi possível recuperar os dados da revisão.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            Talvez a página tenha sido recarregada ou o link foi aberto diretamente. Volte
            para as suas compras e tente novamente.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              to="/purchases"
              className="inline-flex cursor-pointer items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              Voltar para compras
            </Link>
          </div>
        </section>
      </div>
    )
  }

  async function handleConfirm() {
    if (isConfirmingRef.current || !documentId || !reviewed || !purchaseId) return
    // Validação defensiva (a Etapa 3 já validou; aqui só não confiamos cegamente).
    if (!reviewed.productName || !reviewed.purchaseDate || reviewed.price === null) {
      setError('Revise os dados da compra antes de confirmar.')
      return
    }
    if (validatePriceValue(String(reviewed.price))) {
      setError('Revise o valor da compra antes de confirmar.')
      return
    }

    isConfirmingRef.current = true
    setIsConfirming(true)
    setError(null)
    try {
      // Única chamada de persistência: PATCH /documents/:documentId/extraction.
      // Envia apenas os campos suportados; invoiceNumber NÃO é enviado.
      await confirmDocumentExtraction(documentId, reviewed)
      navigate(`/purchases/${purchaseId}`, {
        replace: true,
        state: { flashMessage: 'Compra atualizada com sucesso.' },
      })
    } catch (err) {
      if (err instanceof AuthenticationError) {
        // Token inválido/expirado: segue o padrão global e volta ao login.
        setUser(null)
        navigate('/login', { replace: true })
        return
      }
      // Permanece na confirmação, com os dados preservados, para tentar de novo.
      setError(confirmErrorMessage(err))
    } finally {
      isConfirmingRef.current = false
      setIsConfirming(false)
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      <section>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          Confirme os dados da sua compra
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Revise as informações uma última vez. Ao confirmar, os dados serão aplicados à
          compra.
        </p>
      </section>

      <PurchaseFlowStepper current="confirm" />

      <div className="rounded-xl border-slate-200 bg-white p-5 sm:p-6">
        <dl className="grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          {summary.map((item) => (
            <div key={item.label} className="min-w-0">
              <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
                {item.label}
              </dt>
              <dd className="mt-0.5 truncate text-sm text-slate-900">{item.value}</dd>
            </div>
          ))}
        </dl>

        {/* Número da nota: somente leitura — NÃO é enviado ao backend. */}
        {invoiceNumber && (
          <div className="mt-5 border-t border-slate-100 pt-5">
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Número da nota
            </p>
            <p className="mt-1 text-sm break-words text-slate-900">{invoiceNumber}</p>
            <p className="mt-1 text-xs text-slate-400">
              Este dado será utilizado futuramente.
            </p>
          </div>
        )}

        {error && (
          <div
            ref={errorRef}
            role="alert"
            tabIndex={-1}
            className="mt-5 flex items-start gap-2.5 rounded-lg border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <AlertCircle
              className="h-4 w-4 shrink-0 translate-y-0.5"
              aria-hidden="true"
            />
            <span>{error}</span>
          </div>
        )}

        <div className="mt-6 flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() =>
              navigate('/purchases/new', {
                replace: true,
                state: {
                  purchaseId,
                  documentId,
                  reviewed,
                  invoiceNumber,
                },
              })
            }
            disabled={isConfirming}
            className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isConfirming}
            className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isConfirming ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Confirmando...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>Confirmar dados</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
