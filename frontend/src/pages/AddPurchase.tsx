import { useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import { PurchaseForm } from '../components/purchases/PurchaseForm.tsx'
import {
  EMPTY_PURCHASE_FIELDS,
  toPurchasePayload,
  validatePurchaseFields,
  type PurchaseFormFields,
} from '../components/purchases/purchase-form.ts'
import { InvoiceUploadCard } from '../components/purchases/InvoiceUploadCard.tsx'
import { GuestPurchaseNotice } from '../components/purchases/GuestPurchaseNotice.tsx'
import { PurchaseDraftRestoreBanner } from '../components/purchases/PurchaseDraftRestoreBanner.tsx'
import { DiscardDraftDialog } from '../components/purchases/DiscardDraftDialog.tsx'
import {
  clearGuestPurchaseDraft,
  getGuestPurchaseDraft,
  saveGuestPurchaseDraft,
} from '../services/guest-drafts.ts'
import { ExtractionPreview } from '../components/purchases/ExtractionPreview.tsx'
import { PurchaseFlowStepper } from '../components/purchases/PurchaseFlowStepper.tsx'
import {
  documentNameFromFileName,
  extractFriendlyMessage,
} from '../components/purchases/purchase-document.ts'
import {
  createPurchase,
  uploadPurchaseDocument,
  extractDocument,
  AuthenticationError,
  ApiError,
} from '../lib/api.ts'
import { useAuth } from '../contexts/auth-context.ts'
import type { CreatePurchaseInput } from '../types/purchase.ts'
import type { DocumentExtraction } from '../types/document.ts'

/**
 * Mensagem amigável para falha ao criar a compra (sem detalhes internos).
 * Nunca reaproveita `error.message` cru: o backend pode responder com textos
 * técnicos (ex.: "Something went wrong", "Validation failed").
 */
const createErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.'
    }
    if (error.status === 400) {
      return 'Confira os dados da compra e tente novamente.'
    }
    if (error.status === 403) {
      return 'Você não tem permissão para cadastrar compras.'
    }
  }
  return 'Não foi possível cadastrar a compra. Tente novamente.'
}

/** Mensagem amigável para falha no upload da nota fiscal (compra preservada). */
const uploadErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return 'A compra foi criada, mas não conseguimos anexar a nota fiscal: falha de conexão. Tente novamente.'
    }
    if (error.status === 400) {
      return 'A compra foi criada, mas o arquivo da nota não foi aceito. Envie um PDF, JPG ou PNG de até 10 MB.'
    }
    if (error.status === 403) {
      return 'A compra foi criada, mas você não tem permissão para anexar documentos a ela.'
    }
    if (error.status === 404) {
      return 'A compra foi criada, mas não a encontramos para anexar a nota fiscal. Volte para as suas compras.'
    }
  }
  return 'A compra foi criada, mas não conseguimos anexar a nota fiscal. Tente novamente.'
}

/**
 * Etapa de submissão em andamento. Modela explicitamente cada requisição do
 * fluxo para: (1) bloquear ações concorrentes e (2) mostrar o texto correto.
 * `idle` = nada em andamento; `creating` = POST /purchases;
 * `uploading` = POST /purchases/:id/documents; `extracting` = POST /extract.
 */
type SubmissionState = 'idle' | 'creating' | 'uploading' | 'extracting'

/**
 * Estado da análise por IA, iniciada somente depois que a nota foi anexada.
 * `idle` = nada a analisar; `extracting` = POST /extract em andamento;
 * `success`/`error` = resultado guardado APENAS na UI (nada salvo na compra).
 */
type ExtractionState =
  | { status: 'idle' }
  | { status: 'extracting' }
  | { status: 'success'; data: DocumentExtraction }
  | { status: 'error'; message: string }

export function AddPurchase() {
  const navigate = useNavigate()
  const location = useLocation()
  const { expireSession, status } = useAuth()
  const isGuest = status === 'guest'
  // Dados vindos da etapa de confirmação ("Voltar") — preservam a revisão.
  const returnedState =
    (location.state as {
      purchaseId?: string
      documentId?: string
      reviewed?: DocumentExtraction
      invoiceNumber?: string | null
      resumeAction?: string
    } | null) ?? null
  const [formError, setFormError] = useState<string | null>(null)
  const [submission, setSubmission] = useState<SubmissionState>('idle')
  const [isSuccess, setIsSuccess] = useState(false)
  // Guarda síncrona contra duplo disparo de POST /purchases: `isSubmitting`
  // (estado React) não é atualizado a tempo em dois cliques no mesmo tick.
  const isSubmittingRef = useRef(false)
  // Compra já criada quando o upload da nota fiscal falha. Guardar o id
  // permite tentar o upload novamente SEM recriar a compra (sem duplicar).
  // Também é restaurado ao voltar da confirmação.
  const [createdPurchaseId, setCreatedPurchaseId] = useState<string | null>(
    returnedState?.purchaseId ?? null,
  )

  // Nota fiscal selecionada (opcional). Não é lida nem enviada até o envio.
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)

  // Análise por IA (somente leitura — nada é aplicado à compra nesta etapa).
  const [documentId, setDocumentId] = useState<string | null>(
    returnedState?.documentId ?? null,
  )
  // Ao voltar da confirmação, reabre a revisão com os dados revisados.
  const [extraction, setExtraction] = useState<ExtractionState>(
    returnedState?.reviewed
      ? { status: 'success', data: returnedState.reviewed }
      : { status: 'idle' },
  )
  // Guarda síncrona contra duplo disparo de /extract (evita chamadas duplicadas).
  const isExtractingRef = useRef(false)

  // --- Rascunho de visitante (etapa de acesso progressivo) ----------------
  // O rascunho é lido do localStorage SÓ para usuário autenticado. Em guest,
  // nenhum rascunho é restaurado aqui (ele é criado ao tentar salvar).
  // `discardedDraft` esconde o rascunho após o usuário descartá-lo.
  const [discardedDraft, setDiscardedDraft] = useState(false)
  // Erro específico da retomada (POST do "Continuar e salvar").
  const [restoreError, setRestoreError] = useState<string | null>(null)
  // Confirmação de descarte do rascunho (diálogo leve).
  const [isDiscardOpen, setIsDiscardOpen] = useState(false)
  // `key` do formulário: força remontagem ao limpar os campos restaurados.
  const [formKey, setFormKey] = useState(0)
  // Origem do envio: quando vem do banner de retomada, o erro aparece ali.
  const submitFromRestoreRef = useRef(false)

  // Derivado (sem efeito): só há restauração quando o usuário está autenticado
  // e ainda não descartou o rascunho.
  const restoredDraft = useMemo(
    () =>
      status === 'authenticated' && !discardedDraft ? getGuestPurchaseDraft() : null,
    [status, discardedDraft],
  )
  const restoredFields = restoredDraft?.data ?? null

  // Etapa destacada no stepper: após a compra criada, o fluxo é da IA.
  const currentStep =
    extraction.status === 'extracting' ? 'review' : createdPurchaseId ? 'upload' : 'form'

  /**
   * Visitante: valida o formulário, salva o rascunho local e leva ao login.
   * NENHUMA chamada de API acontece aqui — nem POST /purchases nem upload.
   */
  function handleGuestSubmit(fields: PurchaseFormFields) {
    if (isSubmittingRef.current) return
    const errors = validatePurchaseFields(fields)
    if (Object.keys(errors).length > 0) return
    saveGuestPurchaseDraft(fields)
    navigate('/login', {
      state: { from: { pathname: '/purchases/new' }, resumeAction: 'purchase-draft' },
    })
  }

  async function handleSubmit(payload: CreatePurchaseInput) {
    // Guarda síncrona: dois cliques no mesmo tick não disparam dois POST.
    if (isSubmittingRef.current || isSuccess) return
    isSubmittingRef.current = true
    setFormError(null)
    setRestoreError(null)

    // Se a compra já foi criada numa tentativa anterior, não cria de novo:
    // apenas tenta anexar a nota fiscal novamente (evita duplicar a compra).
    if (createdPurchaseId) {
      await attachInvoice(createdPurchaseId)
      return
    }

    // Estado explícito: o botão mostra "Salvando compra..." durante o POST.
    setSubmission('creating')

    let purchaseId: string
    try {
      const purchase = await createPurchase(payload)
      purchaseId = purchase.id
    } catch (error) {
      if (error instanceof AuthenticationError) {
        // Sessão inválida/expirada: NUNCA limpa o rascunho local (a limpeza só
        // acontece após um POST confirmado). Vai ao login carregando a intenção
        // de retomada para que o rascunho possa ser recuperado depois.
        expireSession()
        navigate('/login', {
          replace: true,
          state: { from: { pathname: '/purchases/new' }, resumeAction: 'purchase-draft' },
        })
        return
      }
      // Compra NÃO criada: nenhum upload é feito. Os dados digitados são
      // preservados (o formulário continua montado) e o botão volta ao normal.
      const message = createErrorMessage(error)
      setFormError(message)
      if (submitFromRestoreRef.current) setRestoreError(message)
      setSubmission('idle')
      isSubmittingRef.current = false
      return
    }

    // Compra criada com sucesso: o rascunho já pode ser descartado. Só aqui,
    // nunca antes do POST confirmado.
    clearGuestPurchaseDraft()
    setDiscardedDraft(true)

    // Compra criada: a partir daqui ela existe mesmo que o upload falhe.
    setCreatedPurchaseId(purchaseId)

    if (!invoiceFile || invoiceError) {
      finishSuccess()
      return
    }

    await attachInvoice(purchaseId)
  }

  /**
   * Anexa a nota fiscal à compra já criada. Em sucesso navega para os detalhes;
   * em falha mantém a compra e informa o problema, permitindo nova tentativa.
   */
  async function attachInvoice(purchaseId: string) {
    if (!invoiceFile || invoiceError) {
      finishSuccess()
      return
    }
    setSubmission('uploading')
    try {
      const document = await uploadPurchaseDocument(
        purchaseId,
        invoiceFile,
        documentNameFromFileName(invoiceFile.name),
        'INVOICE',
      )
      // Nota anexada: inicia a análise por IA (sem salvar nada na compra).
      setDocumentId(document.id)
      isSubmittingRef.current = false
      setSubmission('idle')
      await runExtraction(document.id)
    } catch (error) {
      if (error instanceof AuthenticationError) {
        expireSession()
        navigate('/login', { replace: true })
        return
      }
      // Compra mantida; o retry refaz SOMENTE o upload (não recria a compra).
      setFormError(uploadErrorMessage(error))
      setSubmission('idle')
      isSubmittingRef.current = false
    }
  }

  /**
   * Executa a análise por IA do documento já anexado:
   * POST /documents/:documentId/extract — única operação extra além do upload.
   * Nada é aplicado à compra: o resultado fica apenas no estado da UI.
   */
  async function runExtraction(targetDocumentId: string) {
    // Guarda síncrona: ignora cliques repetidos enquanto uma análise corre.
    if (isExtractingRef.current) return
    isExtractingRef.current = true
    setSubmission('extracting')
    setExtraction({ status: 'extracting' })
    try {
      const data = await extractDocument(targetDocumentId)
      setExtraction({ status: 'success', data })
    } catch (error) {
      if (error instanceof AuthenticationError) {
        expireSession()
        navigate('/login', { replace: true })
        return
      }
      // Não apaga compra nem documento; permite tentar novamente.
      setExtraction({
        status: 'error',
        message: extractFriendlyMessage(error instanceof ApiError ? error : null),
      })
    } finally {
      isExtractingRef.current = false
      setSubmission('idle')
    }
  }

  /**
   * Conclui o envio do fluxo MANUAL (sem nota fiscal): navega para a lista.
   * O fluxo com nota segue para a confirmação final, que faz o PATCH.
   */
  function finishSuccess() {
    setIsSuccess(true)
    setSubmission('idle')
    isSubmittingRef.current = false
    navigate('/purchases', { replace: true })
  }

  /**
   * "Continuar e salvar" do banner de retomada: envia o rascunho restaurado
   * pela mesma rota de criação. O rascunho só é limpo dentro de `handleSubmit`,
   * e apenas após o POST ter sucesso.
   */
  function handleContinueRestore() {
    if (!restoredFields) return
    submitFromRestoreRef.current = true
    void handleSubmit(toPurchasePayload(restoredFields))
  }

  /** "Descartar": abre a confirmação leve; nada é enviado à API. */
  function handleDiscard() {
    setIsDiscardOpen(true)
  }

  /** Confirmado o descarte: limpa rascunho e formulário, sem chamar API. */
  function confirmDiscard() {
    clearGuestPurchaseDraft()
    setDiscardedDraft(true)
    setRestoreError(null)
    setIsDiscardOpen(false)
    setFormKey((key) => key + 1)
  }

  // Campos iniciais do formulário: rascunho restaurado (autenticado) ou vazio.
  const initialFields = useMemo(
    () => restoredFields ?? EMPTY_PURCHASE_FIELDS,
    [restoredFields],
  )

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header do conteúdo */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="mb-2 text-[10px] font-bold tracking-[0.18em] text-emerald-600 uppercase">
            Novo registro
          </p>
          <h2 className="text-2xl font-bold tracking-[-0.03em] text-slate-950 sm:text-3xl">
            Adicionar compra
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Cadastre os dados do produto para acompanhar a garantia depois.
          </p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/purchases')}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:text-sm"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Voltar</span>
        </button>
      </section>

      {/* Aviso de modo visitante: o formulário funciona, mas só salva após o
          login. Nada bloqueia o preenchimento. */}
      {isGuest && !restoredFields && <GuestPurchaseNotice />}

      {/* Confirmação de retomada após o login: nada é salvo sem clique em
          "Continuar e salvar". */}
      {!isGuest && restoredFields && (
        <PurchaseDraftRestoreBanner
          onContinue={handleContinueRestore}
          onDiscard={handleDiscard}
          isSubmitting={submission !== 'idle'}
          errorMessage={restoreError}
        />
      )}

      {/* Indicador de progresso — apenas no fluxo com nota fiscal. O fluxo
          manual (sem nota) não exibe stepper para continuar simples. */}
      {(invoiceFile || createdPurchaseId) && (
        <PurchaseFlowStepper current={currentStep} />
      )}

      {/* Enquanto a IA analisa (ou após o resultado), a etapa de cadastro é
          substituída pelo estado da análise — a compra e a nota já existem. */}
      {documentId && extraction.status !== 'idle' ? (
        <ExtractionStage
          state={extraction}
          onRetry={() => {
            if (documentId) void runExtraction(documentId)
          }}
          onContinue={(reviewed) => {
            // Avança para a confirmação final levando o necessário via
            // location.state (preserva a arquitetura da Etapa 3). A persistência
            // (PATCH) acontece somente na confirmação.
            if (!createdPurchaseId || !documentId) return
            navigate('/purchases/new/confirm', {
              state: {
                purchaseId: createdPurchaseId,
                documentId,
                extraction: reviewed,
                invoiceNumber:
                  extraction.status === 'success' ? extraction.data.invoiceNumber : null,
              },
            })
          }}
          onBack={() => {
            // Volta ao estado anterior sem criar compra/documento/extração.
            setExtraction({ status: 'idle' })
          }}
          canContinue={submission === 'idle'}
        />
      ) : (
        <>
          {/* Importar nota fiscal (opcional). Visitante vê o card, mas a ação
              de upload exige autenticação. */}
          <InvoiceUploadCard
            file={invoiceFile}
            fileError={invoiceError}
            onFileChange={(nextFile, error) => {
              setInvoiceFile(nextFile)
              setInvoiceError(error)
            }}
            disabled={submission !== 'idle' || isSuccess}
            guestLocked={isGuest}
            loadingLabel={
              submission === 'creating' ? 'Salvando compra...' : 'Anexando nota fiscal...'
            }
          />

          {/* Divisor com alternativa manual */}
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
            <span className="text-xs font-medium text-slate-500">
              Ou preencha os dados manualmente
            </span>
            <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_12px_36px_-28px_rgb(15_23_42/0.55)] sm:p-6">
            {isSuccess && (
              <div
                role="status"
                className="mb-5 flex items-start gap-2.5 rounded-lg border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-700"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Compra cadastrada com sucesso! Redirecionando…</span>
              </div>
            )}

            {createdPurchaseId && formError && !isSuccess && (
              <div
                role="alert"
                className="mb-5 flex items-start gap-2.5 rounded-lg border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{formError}</span>
              </div>
            )}

            <PurchaseForm
              key={formKey}
              initialFields={initialFields}
              submitLabel={
                createdPurchaseId ? 'Tentar anexar nota novamente' : 'Salvar compra'
              }
              submittingLabel={
                createdPurchaseId ? 'Anexando nota fiscal...' : 'Salvando compra...'
              }
              formError={
                createdPurchaseId || (restoredFields && restoreError) ? null : formError
              }
              isSubmitting={submission !== 'idle'}
              isSuccess={isSuccess}
              onSubmit={handleSubmit}
              onSubmitFields={isGuest ? handleGuestSubmit : undefined}
              onCancel={() => navigate('/purchases')}
            />
          </div>
        </>
      )}

      {isDiscardOpen && (
        <DiscardDraftDialog
          onClose={() => setIsDiscardOpen(false)}
          onConfirm={confirmDiscard}
        />
      )}
    </div>
  )
}

interface ExtractionStageProps {
  state: ExtractionState
  onRetry: () => void
  onContinue: (reviewed: DocumentExtraction) => void
  onBack: () => void
  /** `false` enquanto uma requisição está em andamento (bloqueia a revisão). */
  canContinue: boolean
}

/**
 * Etapa pós-upload: análise da nota pela IA, revisão do resultado e retry.
 * Nada aqui é salvo na compra — a revisão vive apenas no estado local.
 */
function ExtractionStage({
  state,
  onRetry,
  onContinue,
  onBack,
  canContinue,
}: ExtractionStageProps) {
  const isBusy = state.status === 'extracting'

  return (
    <div className="space-y-5">
      {isBusy && (
        <div
          role="status"
          aria-busy="true"
          aria-live="polite"
          className="flex items-start gap-3 rounded-xl border-slate-200 bg-white p-5 sm:p-6"
        >
          <Loader2
            className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-emerald-600"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900">
              Analisando sua nota fiscal...
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Estamos identificando os dados da compra. Isso pode levar alguns segundos.
            </p>
          </div>
        </div>
      )}

      {state.status === 'error' && (
        <div className="rounded-xl border-slate-200 bg-white p-5 sm:p-6">
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-lg border-amber-200 bg-amber-50 px-3.5 py-3 text-sm text-amber-800"
          >
            <AlertCircle
              className="h-4 w-4 shrink-0 translate-y-0.5"
              aria-hidden="true"
            />
            <span>{state.message}</span>
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Sua compra e a nota fiscal foram salvas. Você pode tentar a análise novamente.
          </p>
          <div className="mt-4 flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>Tentar novamente</span>
            </button>
            <button
              type="button"
              onClick={onBack}
              className="inline-flex cursor-pointer items-center justify-center rounded-lg border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
            >
              Ir para a compra
            </button>
          </div>
        </div>
      )}

      {state.status === 'success' && (
        <ExtractionPreview
          data={state.data}
          onContinue={onContinue}
          onBack={onBack}
          isSubmitting={!canContinue}
        />
      )}
    </div>
  )
}
