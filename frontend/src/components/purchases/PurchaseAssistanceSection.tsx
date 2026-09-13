import { useCallback, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  AlertCircle,
  CalendarClock,
  CheckCircle,
  Clock,
  FileText,
  LifeBuoy,
  Lightbulb,
  ListChecks,
  Loader2,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  ShieldX,
  Sparkles,
  Wrench,
  type LucideIcon,
} from 'lucide-react'
import {
  analyzeAssistance,
  prepareAssistance,
  AuthenticationError,
} from '../../lib/api.ts'
import { formatDateBR } from '../../lib/formatters.ts'
import type {
  Assistance,
  AssistanceAnalysis,
  AssistancePurchase,
  AssistanceWarrantyStatus,
} from '../../types/assistance.ts'
import {
  PROBLEM_MAX_LENGTH,
  PROBLEM_MIN_LENGTH,
  analysisErrorMessage,
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

/**
 * Estado da análise com IA, independente da preparação. Assim o status da
 * garantia continua visível enquanto a IA carrega (ou se ela falhar).
 */
type AnalysisState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; analysis: AssistanceAnalysis }

export interface PurchaseAssistanceSectionProps {
  purchaseId: string
  /** Token inválido/expirado (401): segue o fluxo de autenticação global. */
  onAuthError: () => void
}

/**
 * Seção "Precisa de assistência?" da página de detalhes da compra.
 *
 * Estado inicial: apenas o formulário — nenhum POST automático e nenhuma
 * chamada no mount (a seção não usa efeitos, então o StrictMode não duplica
 * nada aqui). Ao enviar, o fluxo é sequencial: POST /assistance e, somente se
 * ele der certo, POST /assistance/analyze com o MESMO problema. Nunca em
 * paralelo; nenhum GET adicional. O status da garantia vem do endpoint de
 * preparação e permanece visível mesmo se a IA falhar. Nada é persistido
 * localmente: recarregar a página volta ao formulário (backend stateless).
 */
export function PurchaseAssistanceSection({
  purchaseId,
  onAuthError,
}: PurchaseAssistanceSectionProps) {
  const [state, setState] = useState<SectionState>({ status: 'form' })
  const [analysis, setAnalysis] = useState<AnalysisState>({ status: 'idle' })
  const [problem, setProblem] = useState('')
  // Erro de validação só aparece após uma tentativa de envio.
  const [validationError, setValidationError] = useState<string | null>(null)
  // Guarda síncrona contra duplo clique/requisições simultâneas — mesmo padrão
  // de AddPurchase/ConfirmExtraction (o estado React não atualiza a tempo em
  // dois cliques no mesmo tick). Cobre preparação E análise.
  const isSubmittingRef = useRef(false)

  const trimmedLength = problem.trim().length
  /**
   * Executa SOMENTE a análise com IA, reaproveitando o problema já enviado.
   * É usada pelo fluxo principal (depois da preparação) e pelo retry da análise
   * — que assim NÃO repete o POST de preparação.
   */
  const runAnalysis = useCallback(
    async (trimmedProblem: string) => {
      setAnalysis({ status: 'loading' })
      try {
        const result = await analyzeAssistance(purchaseId, trimmedProblem)
        setAnalysis({ status: 'success', analysis: result })
      } catch (error) {
        if (error instanceof AuthenticationError) {
          onAuthError()
          return
        }
        setAnalysis({ status: 'error', message: analysisErrorMessage() })
      }
    },
    [purchaseId, onAuthError],
  )

  /**
   * Fluxo principal, estritamente sequencial: prepara (garantia) e, SÓ se isso
   * der certo, chama a análise com o MESMO problema. Se a preparação falhar, a
   * IA não é chamada — mantém o erro atual da preparação.
   */
  const runRequest = useCallback(
    async (rawProblem: string) => {
      isSubmittingRef.current = true
      setAnalysis({ status: 'idle' })
      setState({ status: 'loading' })
      const trimmedProblem = rawProblem.trim()
      try {
        const assistance = await prepareAssistance(purchaseId, trimmedProblem)
        setState({ status: 'success', assistance })
        // Serially, somente após sucesso da preparação (nunca em paralelo).
        await runAnalysis(trimmedProblem)
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
    [purchaseId, onAuthError, runAnalysis],
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

  /** Retry da preparação: repete a solicitação inteira com o problema atual. */
  const handleRetry = () => {
    if (isSubmittingRef.current) return
    void runRequest(problem)
  }

  /**
   * Retry da ANÁLISE: chama apenas `/assistance/analyze` com o mesmo problema e
   * o mesmo purchaseId — sem repetir a preparação (evita chamada desnecessária).
   * A guarda síncrona evita disparar duas análises em cliques rápidos.
   */
  const handleRetryAnalysis = () => {
    if (isSubmittingRef.current) return
    isSubmittingRef.current = true
    void runAnalysis(problem.trim()).finally(() => {
      isSubmittingRef.current = false
    })
  }

  /**
   * Volta ao formulário inicial: limpa problema, resultado e estados.
   * Nenhuma chamada à API é feita aqui.
   */
  const handleNewRequest = () => {
    setState({ status: 'form' })
    setAnalysis({ status: 'idle' })
    setProblem('')
    setValidationError(null)
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
            analysis={analysis}
            onRetryAnalysis={handleRetryAnalysis}
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
  analysis: AnalysisState
  onRetryAnalysis: () => void
  onNewRequest: () => void
}

/**
 * Resultado da solicitação. Usa exatamente o que o backend retornou: o status
 * da garantia, o problema normalizado e as datas (quando existem). Nenhuma data
 * é inventada quando `warranty` é `null`.
 *
 * A orientação da IA coexiste com o status da garantia: ele permanece visível
 * mesmo enquanto a análise carrega ou se ela falhar.
 */
function AssistanceResult({
  assistance,
  analysis,
  onRetryAnalysis,
  onNewRequest,
}: AssistanceResultProps) {
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

      <AssistanceAnalysisBlock analysis={analysis} onRetry={onRetryAnalysis} />

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

/**
 * Área da orientação com IA. Visualmente distinta (fundo esverdeado suave) para
 * separar do bloco de garantia. Cada estado tem texto próprio — nada depende só
 * da cor. O texto da IA é exibido exatamente como o backend devolveu.
 */
function AssistanceAnalysisBlock({
  analysis,
  onRetry,
}: {
  analysis: AnalysisState
  onRetry: () => void
}) {
  if (analysis.status === 'idle') return null
  return (
    <div className="rounded-xl border-emerald-100 bg-emerald-50/40 p-4 sm:p-5">
      <h4 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Sparkles className="h-4 w-4 text-emerald-600" aria-hidden="true" />
        <span>Orientação para o seu problema</span>
      </h4>

      {analysis.status === 'loading' && (
        <p
          role="status"
          aria-live="polite"
          className="mt-4 flex items-center gap-2 text-sm text-slate-600"
        >
          <Loader2 className="h-4 w-4 animate-spin text-emerald-600" aria-hidden="true" />
          <span>Analisando seu problema...</span>
        </p>
      )}

      {analysis.status === 'error' && (
        <div
          role="alert"
          className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800"
        >
          <span className="flex min-w-0 items-start gap-2.5">
            <AlertCircle
              className="h-4 w-4 shrink-0 translate-y-0.5"
              aria-hidden="true"
            />
            <span>{analysis.message}</span>
          </span>
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-lg border-amber-200 bg-white px-3 py-2 text-xs font-semibold text-amber-800 shadow-xs transition-colors hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600 sm:text-sm"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            <span>Tentar novamente</span>
          </button>
        </div>
      )}

      {analysis.status === 'success' && (
        <AssistanceAnalysisContent analysis={analysis.analysis} />
      )}
    </div>
  )
}

/** Apresenta o resultado estruturado da IA, sem reescrever nenhum texto. */
function AssistanceAnalysisContent({ analysis }: { analysis: AssistanceAnalysis }) {
  return (
    <div className="mt-4 space-y-4">
      <AnalysisField icon={Lightbulb} label="Resumo">
        <p className="whitespace-pre-wrap text-sm text-slate-700">{analysis.summary}</p>
      </AnalysisField>

      {analysis.possibleCauses.length > 0 && (
        <AnalysisField icon={ListChecks} label="Possíveis causas">
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {analysis.possibleCauses.map((cause, index) => (
              <li key={index} className="whitespace-pre-wrap">
                {cause}
              </li>
            ))}
          </ul>
        </AnalysisField>
      )}

      <AnalysisField icon={Wrench} label="O que fazer agora">
        <p className="whitespace-pre-wrap text-sm text-slate-700">
          {analysis.recommendedAction}
        </p>
      </AnalysisField>

      <AnalysisField icon={ShieldAlert} label="Atenção">
        <p className="whitespace-pre-wrap text-sm text-slate-700">
          {analysis.safetyNote}
        </p>
      </AnalysisField>

      <AnalysisField icon={ShieldCheck} label="Sobre sua garantia">
        <p className="whitespace-pre-wrap text-sm text-slate-700">
          {analysis.warrantyGuidance}
        </p>
      </AnalysisField>

      {/* O título deixa explícito que são documentos que PODEM ser solicitados.
          A lista usa <ul> semântico e apenas renderiza o que veio do backend. */}
      {analysis.requiredDocuments.length > 0 && (
        <AnalysisField icon={FileText} label="Documentos que podem ser solicitados">
          <ul className="list-disc space-y-1 pl-5 text-sm break-words text-slate-700">
            {analysis.requiredDocuments.map((document, index) => (
              <li key={index} className="whitespace-pre-wrap">
                {document}
              </li>
            ))}
          </ul>
        </AnalysisField>
      )}
    </div>
  )
}

function AnalysisField({
  icon: Icon,
  label,
  children,
}: {
  icon: LucideIcon
  label: string
  children: ReactNode
}) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-wide text-slate-500 uppercase">
        <Icon className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        <span>{label}</span>
      </p>
      <div className="mt-1.5">{children}</div>
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
