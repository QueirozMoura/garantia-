import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, CheckCircle2, Loader2, RefreshCw } from 'lucide-react'
import { PurchaseForm } from '../components/purchases/PurchaseForm.tsx'
import { EMPTY_PURCHASE_FIELDS } from '../components/purchases/purchase-form.ts'
import { InvoiceUploadCard } from '../components/purchases/InvoiceUploadCard.tsx'
import { ExtractionPreview } from '../components/purchases/ExtractionPreview.tsx'
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

const FALLBACK_ERROR = 'Não foi possível cadastrar a compra. Tente novamente.'
const FALLBACK_DOCUMENT_ERROR =
  'Sua compra foi criada, mas não conseguimos anexar a nota fiscal.'

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
  const { setUser } = useAuth()
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  // Compra já criada quando o upload da nota fiscal falha. Guardar o id
  // permite tentar o upload novamente SEM recriar a compra (sem duplicar).
  const [createdPurchaseId, setCreatedPurchaseId] = useState<string | null>(null)

  // Nota fiscal selecionada (opcional). Não é lida nem enviada até o envio.
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null)
  const [invoiceError, setInvoiceError] = useState<string | null>(null)

  // Análise por IA (somente leitura — nada é aplicado à compra nesta etapa).
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [extraction, setExtraction] = useState<ExtractionState>({ status: 'idle' })
  // Guarda síncrona contra duplo disparo de /extract (evita chamadas duplicadas).
  const isExtractingRef = useRef(false)

  async function handleSubmit(payload: CreatePurchaseInput) {
    if (isSubmitting || isSuccess) return
    setFormError(null)
    setIsSubmitting(true)

    // Se a compra já foi criada numa tentativa anterior, não cria de novo:
    // apenas tenta anexar a nota fiscal novamente (evita duplicar a compra).
    if (createdPurchaseId) {
      await attachInvoice(createdPurchaseId)
      return
    }

    let purchaseId: string
    try {
      const purchase = await createPurchase(payload)
      purchaseId = purchase.id
    } catch (error) {
      if (error instanceof AuthenticationError) {
        setUser(null)
        navigate('/login', { replace: true })
        return
      }
      // Compra NÃO criada: nenhum upload é feito. Erro amigável + retry.
      const message = error instanceof ApiError ? error.message : FALLBACK_ERROR
      setFormError(message)
      setIsSubmitting(false)
      return
    }

    // Compra criada: a partir daqui ela existe mesmo que o upload falhe.
    setCreatedPurchaseId(purchaseId)

    if (!invoiceFile || invoiceError) {
      finishSuccess(purchaseId)
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
      finishSuccess(purchaseId)
      return
    }
    try {
      const document = await uploadPurchaseDocument(
        purchaseId,
        invoiceFile,
        documentNameFromFileName(invoiceFile.name),
        'INVOICE',
      )
      // Nota anexada: inicia a análise por IA (sem salvar nada na compra).
      setDocumentId(document.id)
      setIsSubmitting(false)
      await runExtraction(document.id)
    } catch (error) {
      if (error instanceof AuthenticationError) {
        setUser(null)
        navigate('/login', { replace: true })
        return
      }
      // Compra mantida; usuário pode tentar anexar novamente sem recriar.
      setFormError(FALLBACK_DOCUMENT_ERROR)
      setIsSubmitting(false)
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
    setExtraction({ status: 'extracting' })
    try {
      const data = await extractDocument(targetDocumentId)
      setExtraction({ status: 'success', data })
    } catch (error) {
      if (error instanceof AuthenticationError) {
        setUser(null)
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
    }
  }

  /**
   * Conclui o envio com sucesso. Com nota fiscal (ou retry), vai para os
   * detalhes da compra criada; no fluxo manual sem nota, mantém o destino
   * anterior (/purchases). O resultado da extração (se houver) é levado via
   * state de navegação, para ficar disponível à próxima etapa.
   */
  function finishSuccess(purchaseId: string | null = null) {
    setIsSuccess(true)
    if (purchaseId !== null && (invoiceFile || createdPurchaseId)) {
      navigate(`/purchases/${purchaseId}`, {
        replace: true,
        state:
          extraction.status === 'success' ? { extraction: extraction.data } : undefined,
      })
      return
    }
    navigate('/purchases', { replace: true })
  }
  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Header do conteúdo */}
      <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
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

      {/* Enquanto a IA analisa (ou após o resultado), a etapa de cadastro é
          substituída pelo estado da análise — a compra e a nota já existem. */}
      {documentId && extraction.status !== 'idle' ? (
        <ExtractionStage
          state={extraction}
          onRetry={() => {
            if (documentId) void runExtraction(documentId)
          }}
          onContinue={() => finishSuccess(createdPurchaseId)}
        />
      ) : (
        <>
          {/* Importar nota fiscal (opcional) */}
          <InvoiceUploadCard
            file={invoiceFile}
            fileError={invoiceError}
            onFileChange={(nextFile, error) => {
              setInvoiceFile(nextFile)
              setInvoiceError(error)
            }}
            disabled={isSubmitting || isSuccess}
          />

          {/* Divisor com alternativa manual */}
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
            <span className="text-xs font-medium text-slate-500">
              Ou preencha os dados manualmente
            </span>
            <span className="h-px flex-1 bg-slate-200" aria-hidden="true" />
          </div>

          <div className="rounded-xl border-slate-200 bg-white p-5 sm:p-6">
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
                <span>
                  {FALLBACK_DOCUMENT_ERROR} A compra foi salva; você pode tentar anexar a
                  nota novamente.
                </span>
              </div>
            )}

            <PurchaseForm
              initialFields={EMPTY_PURCHASE_FIELDS}
              submitLabel={
                createdPurchaseId ? 'Tentar anexar nota novamente' : 'Salvar compra'
              }
              formError={createdPurchaseId ? null : formError}
              isSubmitting={isSubmitting}
              isSuccess={isSuccess}
              onSubmit={handleSubmit}
              onCancel={() => navigate('/purchases')}
            />
          </div>
        </>
      )}
    </div>
  )
}

interface ExtractionStageProps {
  state: ExtractionState
  onRetry: () => void
  onContinue: () => void
}

/**
 * Etapa pós-upload: análise da nota pela IA, preview do resultado e retry.
 * Nada aqui é salvo na compra — é apenas visualização (somente leitura).
 */
function ExtractionStage({ state, onRetry, onContinue }: ExtractionStageProps) {
  return (
    <div className="space-y-5">
      {state.status === 'extracting' && (
        <div
          role="status"
          aria-busy="true"
          className="flex items-start gap-3 rounded-xl border-slate-200 bg-white p-5 sm:p-6"
        >
          <Loader2
            className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-emerald-600"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-slate-900">
              Analisando sua nota fiscal
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Estamos identificando os dados da sua compra.
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
              onClick={onContinue}
              className="inline-flex cursor-pointer items-center justify-center rounded-lg border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50"
            >
              Ir para a compra
            </button>
          </div>
        </div>
      )}

      {state.status === 'success' && (
        <>
          <ExtractionPreview data={state.data} />
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onContinue}
              className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:w-auto"
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              <span>Ir para a compra</span>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
