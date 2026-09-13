import { useCallback, useRef, useState, type FormEvent } from 'react'
import {
  AlertCircle,
  CalendarClock,
  CheckCircle,
  Clock,
  LifeBuoy,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  ShieldQuestion,
  ShieldX,
  type LucideIcon,
} from 'lucide-react'
import { prepareAssistance, AuthenticationError } from '../../lib/api.ts'
import { formatDateBR } from '../../lib/formatters.ts'
import type {
  Assistance,
  AssistancePurchase,
  AssistanceWarrantyStatus,
} from '../../types/assistance.ts'
import {
  PROBLEM_MAX_LENGTH,
  PROBLEM_MIN_LENGTH,
  assistanceErrorMessage,
  validateProblem,
} from './assistance-form.ts'

interface StatusPresentation {
  title: string
  message: string
  /** Rótulo curto do badge — junto com o ícone, não depende só de cor. */
  badge: string
  icon: LucideIcon
  /** Classes do bloco de ícone. */
  iconClass: string
  badgeClass: string
}

/**
 * Apresentação por `warrantyStatus`. O backend é a fonte da verdade: aqui só
 * mapeamos o status recebido para título/mensagem/ícone. Cada status tem um
 * ícone e um rótulo próprios, para nunca depender apenas de cor.
 */
const STATUS_PRESENTATION: Record<AssistanceWarrantyStatus, StatusPresentation> = {
  ACTIVE: {
    title: 'Garantia ativa',
    message: 'Este produto está dentro do período de garantia.',
    badge: 'Ativa',
    icon: ShieldCheck,
    iconClass: 'bg-emerald-50 text-emerald-600',
    badgeClass: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  },
  EXPIRED: {
    title: 'Garantia expirada',
    message: 'A garantia deste produto já terminou.',
    badge: 'Expirada',
    icon: ShieldX,
    iconClass: 'bg-slate-100 text-slate-500',
    badgeClass: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  },
  UPCOMING: {
    title: 'Garantia ainda não iniciada',
    message: 'A garantia deste produto ainda não começou.',
    badge: 'Ainda não iniciada',
    icon: CalendarClock,
    iconClass: 'bg-amber-50 text-amber-600',
    badgeClass: 'bg-amber-50 text-amber-700 ring-amber-600/20',
  },
  NONE: {
    title: 'Sem garantia cadastrada',
    message: 'Não existe uma garantia cadastrada para esta compra.',
    badge: 'Sem garantia',
    icon: ShieldQuestion,
    iconClass: 'bg-slate-100 text-slate-500',
    badgeClass: 'bg-slate-100 text-slate-600 ring-slate-500/20',
  },
}

type SectionState =
  | { status: 'form' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; assistance: Assistance }

export interface PurchaseAssistanceSectionProps {
  purchaseId: string
  /** Token inválido/expirado (401): segue o fluxo de autenticação global. */
  onAuthError: () => void
}

/**
 * Seção "Precisa de assistência?" da página de detalhes da compra.
 *
 * Estado inicial: apenas o formulário — nenhum POST automático. Ao enviar, faz
 * exatamente um POST /purchases/:purchaseId/assistance e apresenta o resultado
 * já retornado (sem GET adicional). O retry repete a mesma solicitação com o
 * mesmo problema. Nada é persistido localmente: recarregar a página volta ao
 * formulário, o que é esperado porque o backend é stateless.
 */
export function PurchaseAssistanceSection({
  purchaseId,
  onAuthError,
}: PurchaseAssistanceSectionProps) {
  const [state, setState] = useState<SectionState>({ status: 'form' })
  const [problem, setProblem] = useState('')
  // Erro de validação só aparece após uma tentativa de envio.
  const [validationError, setValidationError] = useState<string | null>(null)
  // Guarda síncrona contra duplo clique/duas requisições simultâneas — mesmo
  // padrão de AddPurchase/ConfirmExtraction (o estado React não atualiza a
  // tempo em dois cliques no mesmo tick).
  const isSubmittingRef = useRef(false)

  const trimmedLength = problem.trim().length

  const runRequest = useCallback(
    async (rawProblem: string) => {
      isSubmittingRef.current = true
      setState({ status: 'loading' })
      try {
        const assistance = await prepareAssistance(purchaseId, rawProblem.trim())
        setState({ status: 'success', assistance })
      } catch (error) {
        if (error instanceof AuthenticationError) {
          onAuthError()
          return
        }
        setState({ status: 'error', message: assistanceErrorMessage(error) })
      } finally {
        isSubmittingRef.current = false
      }
    },
    [purchaseId, onAuthError],
  )

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSubmittingRef.current) return
    const error = validateProblem(problem)
    if (error) {
      setValidationError(error)
      // Validação falhou: nenhum POST é disparado.
      return
    }
    setValidationError(null)
    void runRequest(problem)
  }

  /** Retry: repete a MESMA solicitação com o problema já informado. */
  const handleRetry = () => {
    if (isSubmittingRef.current) return
    void runRequest(problem)
  }

  /** Volta ao formulário mantendo o texto, para o usuário ajustar e reenviar. */
  const handleNewRequest = () => {
    setState({ status: 'form' })
  }

  return (
    <section className="rounded-xl border-slate-200 bg-white p-5 sm:p-6">
      <h3 className="text-base font-semibold text-slate-900">Precisa de assistência?</h3>
      <p className="mt-1 text-sm text-slate-500">
        Descreva o problema deste produto e verifique a situação da sua garantia.
      </p>

      <div className="mt-5">
        {state.status === 'success' ? (
          <AssistanceResult
            assistance={state.assistance}
            onNewRequest={handleNewRequest}
          />
        ) : (
          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            {state.status === 'error' && (
              <AssistanceErrorState message={state.message} onRetry={handleRetry} />
            )}

            <div className="min-w-0">
              <label
                htmlFor="assistance-problem"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Descreva o problema
              </label>
              <textarea
                id="assistance-problem"
                name="problem"
                value={problem}
                onChange={(event) => {
                  setProblem(event.target.value)
                  if (validationError) setValidationError(null)
                }}
                placeholder="Ex.: A máquina liga normalmente, mas não está centrifugando."
                rows={4}
                maxLength={PROBLEM_MAX_LENGTH}
                disabled={state.status === 'loading'}
                aria-invalid={Boolean(validationError)}
                aria-describedby="assistance-problem-help assistance-problem-counter"
                className={`w-full resize-y rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500 ${
                  validationError
                    ? 'border-red-300 focus-visible:border-red-400'
                    : 'border-slate-300 focus-visible:border-emerald-500'
                }`}
              />

              <div className="mt-1.5 flex flex-wrap items-start justify-between gap-2">
                {validationError ? (
                  <p
                    id="assistance-problem-help"
                    role="alert"
                    className="text-xs text-red-600"
                  >
                    {validationError}
                  </p>
                ) : (
                  <p id="assistance-problem-help" className="text-xs text-slate-500">
                    Mínimo de {PROBLEM_MIN_LENGTH} e máximo de {PROBLEM_MAX_LENGTH}{' '}
                    caracteres.
                  </p>
                )}
                <p
                  id="assistance-problem-counter"
                  aria-live="polite"
                  className="text-xs text-slate-400 tabular-nums"
                >
                  {trimmedLength}/{PROBLEM_MAX_LENGTH}
                </p>
              </div>
            </div>

            {/* Sem acessibilidade apenas por cor: o loading também tem texto. */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              {state.status === 'loading' && (
                <p
                  role="status"
                  className="flex items-center gap-2 text-sm text-slate-500 sm:mr-auto"
                >
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Verificando sua garantia...</span>
                </p>
              )}
              <button
                type="submit"
                disabled={state.status === 'loading'}
                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {state.status === 'loading' ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Send className="h-4 w-4" aria-hidden="true" />
                )}
                <span>
                  {state.status === 'loading'
                    ? 'Verificando...'
                    : 'Solicitar assistência'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}

/**
 * Bloco de erro da seção, com ação de retry. O retry é um `type="button"`
 * (não submete o form) e repete a MESMA solicitação com o problema já digitado.
 */
function AssistanceErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
    >
      <span className="flex min-w-0 items-start gap-2.5">
        <AlertCircle className="h-4 w-4 shrink-0 translate-y-0.5" aria-hidden="true" />
        <span>{message}</span>
      </span>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-700 shadow-xs transition-colors hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600 sm:text-sm"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        <span>Tentar novamente</span>
      </button>
    </div>
  )
}

interface AssistanceResultProps {
  assistance: Assistance
  onNewRequest: () => void
}

/**
 * Resultado da solicitação. Usa exatamente o que o backend retornou: o status
 * da garantia, o problema normalizado e as datas (quando existem). Nenhuma data
 * é inventada quando `warranty` é `null`.
 */
function AssistanceResult({ assistance, onNewRequest }: AssistanceResultProps) {
  const presentation = STATUS_PRESENTATION[assistance.warrantyStatus]
  const { WarrantyIcon, iconClass, badgeClass } = {
    WarrantyIcon: presentation.icon,
    iconClass: presentation.iconClass,
    badgeClass: presentation.badgeClass,
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${iconClass}`}
        >
          <WarrantyIcon className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-900 sm:text-base">
            {presentation.title}
          </h4>
          <span
            className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${badgeClass}`}
          >
            {presentation.badge}
          </span>
        </div>
      </div>

      <p role="status" className="flex items-start gap-2 text-sm text-slate-600">
        <CheckCircle
          className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600"
          aria-hidden="true"
        />
        <span>{presentation.message}</span>
      </p>

      {/* Problema informado — texto vindo da resposta da API, sem nova requisição. */}
      <div className="rounded-lg border-slate-100 bg-slate-50/60 px-3.5 py-3">
        <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
          Problema informado
        </p>
        <p className="mt-1 text-sm whitespace-pre-wrap text-slate-900">
          {assistance.problem}
        </p>
      </div>

      <AssistancePurchaseSummary purchase={assistance.purchase} />

      {/* Datas da garantia — somente quando a garantia existe. */}
      {assistance.warranty && (
        <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <AssistanceItem
            label="Duração"
            value={`${assistance.warranty.durationMonths} ${
              assistance.warranty.durationMonths === 1 ? 'mês' : 'meses'
            }`}
          />
          <AssistanceItem
            label="Início da garantia"
            value={formatDateBR(assistance.warranty.startDate)}
          />
          <AssistanceItem
            label="Término da garantia"
            value={formatDateBR(assistance.warranty.endDate)}
          />
        </dl>
      )}

      <div className="flex justify-end border-t border-slate-100 pt-5">
        <button
          type="button"
          onClick={onNewRequest}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          <span>Nova solicitação</span>
        </button>
      </div>
    </div>
  )
}

/** Identificação do produto relacionado, no mesmo padrão das demais seções. */
function AssistancePurchaseSummary({ purchase }: { purchase: AssistancePurchase }) {
  const brandModel = [purchase.brand, purchase.model].filter(Boolean).join(' ')
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border-slate-100 bg-white px-3.5 py-3 ring-1 ring-slate-100">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
        <LifeBuoy className="h-4 w-4" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-slate-900">
          {purchase.productName}
        </p>
        <p className="mt-0.5 truncate text-xs text-slate-500">
          {brandModel || purchase.store || '-'}
        </p>
      </div>
      <span className="ml-auto hidden shrink-0 items-center gap-1.5 text-xs text-slate-500 sm:flex">
        <Clock className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
        {formatDateBR(purchase.purchaseDate)}
      </span>
    </div>
  )
}

function AssistanceItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm text-slate-900">{value}</dd>
    </div>
  )
}
