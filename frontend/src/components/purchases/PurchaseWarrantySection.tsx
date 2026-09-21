import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertCircle,
  Pencil,
  RefreshCw,
  ShieldPlus,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
  CalendarClock,
} from 'lucide-react'
import {
  getPurchaseWarranty,
  createPurchaseWarranty,
  updatePurchaseWarranty,
  deletePurchaseWarranty,
  AuthenticationError,
  ApiError,
} from '../../lib/api.ts'
import { useAuth } from '../../contexts/auth-context.ts'
import { formatDateBR } from '../../lib/formatters.ts'
import { getWarrantyStatus } from '../../lib/warranty-status.ts'
import type { Warranty } from '../../types/warranty.ts'
import { DeleteWarrantyDialog } from './DeleteWarrantyDialog.tsx'
import {
  toIsoDateInput,
  toWarrantyPayload,
  validateWarrantyValues,
  type WarrantyFormErrors,
  type WarrantyFormValues,
} from './warranty-form.ts'
import {
  SectionHeader,
  EmptyState,
  Card,
  StatusBadge,
  Button,
  Input,
  FeedbackMessage,
  type StatusBadgeStatus,
} from '../ui'

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; warranty: Warranty | null }

const FALLBACK_ERROR = 'Não foi possível carregar a garantia. Tente novamente.'
const FALLBACK_SAVE_ERROR = 'Não foi possível salvar a garantia. Tente novamente.'
const FALLBACK_UPDATE_ERROR = 'Não foi possível atualizar a garantia. Tente novamente.'
const FALLBACK_DELETE_ERROR = 'Não foi possível excluir a garantia. Tente novamente.'

/** Mensagens amigáveis por status HTTP do DELETE da garantia. */
const deleteWarrantyErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.status === 403) return 'Você não tem permissão para excluir esta garantia.'
    if (error.status === 404) return 'Esta garantia não foi encontrada.'
  }
  return FALLBACK_DELETE_ERROR
}

/**
 * Mensagens amigáveis do PUT da garantia, mapeadas pelo `code` real devolvido
 * pelo backend (não pelo texto cru, que vem em inglês).
 */
const updateWarrantyErrorMessage = (error: unknown) => {
  if (error instanceof ApiError) {
    if (error.code === 'INVALID_WARRANTY_DATE_RANGE') {
      return 'A data de término não pode ser anterior à data de início.'
    }
    if (error.code === 'VALIDATION_ERROR') {
      return 'Verifique os dados informados e tente novamente.'
    }
    if (error.status === 403) return 'Você não tem permissão para editar esta garantia.'
    if (error.code === 'WARRANTY_NOT_FOUND' || error.status === 404) {
      return 'Esta garantia não foi encontrada. Recarregue a página e tente novamente.'
    }
  }
  return FALLBACK_UPDATE_ERROR
}

export interface PurchaseWarrantySectionProps {
  purchaseId: string
}

export function PurchaseWarrantySection({ purchaseId }: PurchaseWarrantySectionProps) {
  const navigate = useNavigate()
  const { expireSession } = useAuth()
  const [state, setState] = useState<FetchState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [showForm, setShowForm] = useState(false)
  // Modo de edição da garantia existente (independente do form de criação).
  const [isEditing, setIsEditing] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  // Feedback de sucesso do PUT, no mesmo padrão das outras telas do projeto.
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    let isActive = true
    const load = async () => {
      try {
        const warranty = await getPurchaseWarranty(purchaseId)
        if (isActive) setState({ status: 'success', warranty })
      } catch (error) {
        if (!isActive) return
        if (error instanceof AuthenticationError) {
          expireSession()
          navigate('/login', { replace: true })
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
  }, [purchaseId, reloadKey, navigate, expireSession])

  const handleRetry = useCallback(() => {
    setState({ status: 'loading' })
    setReloadKey((key) => key + 1)
  }, [])

  const handleCreated = useCallback((warranty: Warranty) => {
    setState({ status: 'success', warranty })
    setShowForm(false)
  }, [])

  /**
   * Aplica o resultado do PUT: a própria resposta é a garantia atualizada, então
   * nenhum GET adicional é necessário para sincronizar a tela.
   */
  const handleUpdated = useCallback((warranty: Warranty) => {
    setState({ status: 'success', warranty })
    setIsEditing(false)
    setSuccessMessage('Garantia atualizada com sucesso.')
  }, [])

  /** Executa a exclusão somente quando o usuário confirma no modal. */
  const handleDelete = useCallback(async () => {
    if (isDeleting) return
    setIsDeleting(true)
    setDeleteError(null)
    try {
      await deletePurchaseWarranty(purchaseId)
      // Sucesso: fecha o modal e volta ao estado vazio, sem recarregar a página.
      setIsDeleteOpen(false)
      setState({ status: 'success', warranty: null })
      // Feedback de sucesso no mesmo padrão do PUT (não aparece em caso de erro).
      setSuccessMessage('Garantia excluída com sucesso.')
    } catch (error) {
      if (error instanceof AuthenticationError) {
        // Token inválido/expirado: consolida o estado visitante e volta ao login.
        expireSession()
        navigate('/login', { replace: true })
        return
      }
      // Mantém o modal aberto para o usuário tentar novamente.
      setDeleteError(deleteWarrantyErrorMessage(error))
    } finally {
      setIsDeleting(false)
    }
  }, [purchaseId, isDeleting, navigate, expireSession])

  return (
    <section className="space-y-5">
      <SectionHeader title="Garantia" />

      <div>
        {state.status === 'loading' && <WarrantySkeleton />}

        {state.status === 'error' && (
          <WarrantyErrorState message={state.message} onRetry={handleRetry} />
        )}

        {state.status === 'success' && state.warranty && !isEditing && (
          <>
            {successMessage && (
              <div className="mb-5">
                <FeedbackMessage variant="success" description={successMessage} />
              </div>
            )}
            <WarrantyCard
              warranty={state.warranty}
              onEdit={() => {
                setSuccessMessage(null)
                setIsEditing(true)
              }}
              onDelete={() => {
                setSuccessMessage(null)
                setDeleteError(null)
                setIsDeleteOpen(true)
              }}
            />
          </>
        )}

        {/* Feedback de sucesso da exclusão — aparece mesmo após a garantia ser
            removida (estado `warranty: null`), quando não há WarrantyCard. */}
        {state.status === 'success' && !state.warranty && successMessage && (
          <div className="mb-5">
            <FeedbackMessage variant="success" description={successMessage} />
          </div>
        )}

        {/* Edição inline — reutiliza o mesmo layout de campos da criação. */}
        {state.status === 'success' && state.warranty && isEditing && (
          <Card className="p-6">
            <WarrantyEditForm
              purchaseId={purchaseId}
              warranty={state.warranty}
              onCancel={() => setIsEditing(false)}
              onUpdated={handleUpdated}
              onAuthError={() => {
                expireSession()
                navigate('/login', { replace: true })
              }}
            />
          </Card>
        )}

        {state.status === 'success' && !state.warranty && !showForm && (
          <WarrantyEmptyState onAdd={() => setShowForm(true)} />
        )}

        {state.status === 'success' && !state.warranty && showForm && (
          <Card className="p-6">
            <WarrantyForm
              purchaseId={purchaseId}
              onCancel={() => setShowForm(false)}
              onCreated={handleCreated}
              onAuthError={() => {
                expireSession()
                navigate('/login', { replace: true })
              }}
            />
          </Card>
        )}
      </div>

      {state.status === 'success' && state.warranty && isDeleteOpen && (
        <DeleteWarrantyDialog
          warranty={state.warranty}
          onClose={() => setIsDeleteOpen(false)}
          onConfirm={handleDelete}
          isDeleting={isDeleting}
          errorMessage={deleteError}
        />
      )}
    </section>
  )
}

/** Loading: skeleton consistente com os demais do projeto. */
function WarrantySkeleton() {
  return (
    <div
      className="space-y-4 animate-pulse"
      aria-busy="true"
      aria-label="Carregando garantia"
    >
      <div className="h-9 w-32 rounded-lg bg-slate-200" />
      <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="space-y-2">
            <div className="h-3 w-20 rounded bg-slate-200" />
            <div className="h-4 w-28 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** Card da garantia existente. */
function WarrantyCard({
  warranty,
  onEdit,
  onDelete,
}: {
  warranty: Warranty
  onEdit: () => void
  onDelete: () => void
}) {
  // Regra canônica vinda do helper central (`lib/warranty-status.ts`) — sem
  // lógica de status duplicada aqui.
  const { status } = getWarrantyStatus(warranty)

  const start = new Date(warranty.startDate).getTime()
  const end = new Date(warranty.endDate).getTime()
  const [now] = useState(() => Date.now())
  let progress = 0
  let showProgress = false

  if (
    !isNaN(start) &&
    !isNaN(end) &&
    start < end &&
    (status === 'active' || status === 'expiring')
  ) {
    const totalDays = end - start
    const daysPassed = now - start
    progress = Math.min(Math.max((daysPassed / totalDays) * 100, 0), 100)
    showProgress = true
  }

  const statusColors: Record<StatusBadgeStatus, string> = {
    active: 'bg-emerald-50 text-emerald-600',
    expiring: 'bg-amber-50 text-amber-600',
    expired: 'bg-slate-100 text-slate-500',
    upcoming: 'bg-sky-50 text-sky-600',
    none: 'bg-slate-100 text-slate-500',
    ACTIVE: 'bg-emerald-50 text-emerald-600',
    EXPIRED: 'bg-slate-100 text-slate-500',
    UPCOMING: 'bg-sky-50 text-sky-600',
    NONE: 'bg-slate-100 text-slate-500',
  }

  const Icon =
    status === 'active'
      ? ShieldCheck
      : status === 'expiring'
        ? ShieldAlert
        : status === 'upcoming'
          ? CalendarClock
          : ShieldX

  return (
    <Card className="overflow-hidden">
      <div className="space-y-6 p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                statusColors[status] || statusColors.expired
              }`}
            >
              <Icon className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <StatusBadge
                status={status}
                label={status === 'expired' ? 'Vencida' : undefined}
              />
            </div>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            <Button
              onClick={onEdit}
              variant="outline"
              className="w-full sm:w-auto"
              leftIcon={<Pencil className="h-4 w-4" aria-hidden="true" />}
            >
              Editar
            </Button>
            <Button
              onClick={onDelete}
              variant="danger"
              className="w-full sm:w-auto"
              leftIcon={<Trash2 className="h-4 w-4" aria-hidden="true" />}
            >
              Excluir garantia
            </Button>
          </div>
        </div>

        <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          <WarrantyItem label="Início" value={formatDateBR(warranty.startDate)} />
          <WarrantyItem label="Término" value={formatDateBR(warranty.endDate)} />
          <WarrantyItem label="Duração" value={`${warranty.durationMonths} meses`} />
        </dl>
      </div>

      {showProgress && (
        <div className="h-1.5 w-full bg-slate-100">
          <div
            className={`h-full transition-all duration-500 ${
              status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </Card>
  )
}

interface WarrantyItemProps {
  label: string
  value: string
}

function WarrantyItem({ label, value }: WarrantyItemProps) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium tracking-wide text-slate-500 uppercase">
        {label}
      </dt>
      <dd className="mt-1 truncate text-sm font-medium text-slate-900">{value}</dd>
    </div>
  )
}

/** Estado sem garantia + botão para abrir o formulário. */
function WarrantyEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <EmptyState
      icon={ShieldPlus}
      title="Esta compra ainda não possui garantia"
      action={
        <Button
          onClick={onAdd}
          variant="primary"
          leftIcon={<ShieldPlus className="h-4 w-4" aria-hidden="true" />}
        >
          Adicionar garantia
        </Button>
      }
    />
  )
}

/** Estado de erro com retry real. */
function WarrantyErrorState({
  message,
  onRetry,
}: {
  message: string
  onRetry: () => void
}) {
  return (
    <div className="rounded-2xl border-slate-200 bg-white p-6 text-center sm:p-8">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
        <AlertCircle className="h-6 w-6 text-amber-600" aria-hidden="true" />
      </div>
      <p className="mx-auto mt-3 max-w-md text-sm text-slate-500">{message}</p>
      <div className="mt-5 flex justify-center">
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          <span>Tentar novamente</span>
        </button>
      </div>
    </div>
  )
}

interface WarrantyFieldsProps {
  /** Prefixo dos ids: criação e edição não ficam na tela ao mesmo tempo, mas os
   * ids seguem distintos para os labels nunca apontarem para o input errado. */
  idPrefix: string
  values: WarrantyFormValues
  errors: WarrantyFormErrors
  disabled: boolean
  onChange: (patch: Partial<WarrantyFormValues>) => void
}

/**
 * Os três campos editáveis da garantia, compartilhados por criação e edição.
 * As datas usam `type="date"`, cujo value já é "YYYY-MM-DD" — o mesmo formato
 * que o backend aceita, sem conversão de fuso.
 */
function WarrantyFields({
  idPrefix,
  values,
  errors,
  disabled,
  onChange,
}: WarrantyFieldsProps) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <Input
        id={`${idPrefix}-duration`}
        name="durationMonths"
        type="number"
        min="1"
        step="1"
        inputMode="numeric"
        label="Duração da garantia (meses)"
        value={values.durationMonths}
        onChange={(event) => onChange({ durationMonths: event.target.value })}
        placeholder="Ex.: 12"
        disabled={disabled}
        error={errors.durationMonths}
      />

      <Input
        id={`${idPrefix}-start`}
        name="startDate"
        type="date"
        label="Data de início"
        value={values.startDate}
        onChange={(event) => onChange({ startDate: event.target.value })}
        disabled={disabled}
        error={errors.startDate}
      />

      <Input
        id={`${idPrefix}-end`}
        name="endDate"
        type="date"
        label="Data de término"
        value={values.endDate}
        onChange={(event) => onChange({ endDate: event.target.value })}
        disabled={disabled}
        error={errors.endDate}
      />
    </div>
  )
}

interface WarrantyFormActionsProps {
  isSaving: boolean
  canSubmit: boolean
  submitLabel: string
  savingLabel: string
  onCancel: () => void
}

function WarrantyFormActions({
  isSaving,
  canSubmit,
  submitLabel,
  savingLabel,
  onCancel,
}: WarrantyFormActionsProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
      <Button type="button" onClick={onCancel} disabled={isSaving} variant="outline">
        Cancelar
      </Button>
      <Button
        type="submit"
        disabled={!canSubmit || isSaving}
        variant="primary"
        isLoading={isSaving}
      >
        {isSaving ? savingLabel : submitLabel}
      </Button>
    </div>
  )
}

/** Erro de envio, no mesmo padrão dos demais formulários do projeto. */
function WarrantySubmitError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-lg border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
    >
      <AlertCircle className="h-4 w-4 shrink-0 translate-y-0.5" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

interface WarrantyFormProps {
  purchaseId: string
  onCancel: () => void
  onCreated: (warranty: Warranty) => void
  onAuthError: () => void
}

/** Formulário inline de criação. Datas enviadas como "YYYY-MM-DD", sem fuso. */
function WarrantyForm({
  purchaseId,
  onCancel,
  onCreated,
  onAuthError,
}: WarrantyFormProps) {
  const [values, setValues] = useState<WarrantyFormValues>({
    durationMonths: '',
    startDate: '',
    endDate: '',
  })
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Validação derivada do helper compartilhado (mesma regra da edição).
  const errors = validateWarrantyValues(values)
  const isValid = Object.keys(errors).length === 0
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!isValid || isSaving) return
    setIsSaving(true)
    setSubmitError(null)
    try {
      const warranty = await createPurchaseWarranty(purchaseId, toWarrantyPayload(values))
      onCreated(warranty)
    } catch (error) {
      if (error instanceof AuthenticationError) {
        onAuthError()
        return
      }
      setSubmitError(error instanceof ApiError ? error.message : FALLBACK_SAVE_ERROR)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <WarrantyFields
        idPrefix="warranty"
        values={values}
        errors={errors}
        disabled={isSaving}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
      />

      {submitError && <WarrantySubmitError message={submitError} />}

      <WarrantyFormActions
        isSaving={isSaving}
        canSubmit={isValid}
        submitLabel="Salvar garantia"
        savingLabel="Salvando..."
        onCancel={onCancel}
      />
    </form>
  )
}

interface WarrantyEditFormProps {
  purchaseId: string
  /** Garantia atual — usada para preencher os campos iniciais. */
  warranty: Warranty
  onCancel: () => void
  onUpdated: (warranty: Warranty) => void
  onAuthError: () => void
}

/**
 * Formulário de edição da garantia existente. Envia PUT com o estado final do
 * formulário (apenas os três campos editáveis) e aplica a resposta do backend
 * na tela — sem GET adicional e sem F5.
 */
function WarrantyEditForm({
  purchaseId,
  warranty,
  onCancel,
  onUpdated,
  onAuthError,
}: WarrantyEditFormProps) {
  const [values, setValues] = useState<WarrantyFormValues>(() => ({
    durationMonths: String(warranty.durationMonths),
    startDate: toIsoDateInput(warranty.startDate),
    endDate: toIsoDateInput(warranty.endDate),
  }))
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  // Guarda síncrona: dois cliques no mesmo tick não disparam dois PUT (o
  // `isSaving` do estado React ainda não teria atualizado). Mesmo padrão do
  // AddPurchase/ConfirmExtraction.
  const isSavingRef = useRef(false)

  const errors = validateWarrantyValues(values)
  const isValid = Object.keys(errors).length === 0
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (isSavingRef.current) return
    // Sem valores válidos, nenhum PUT é disparado.
    if (!isValid) return
    isSavingRef.current = true
    setIsSaving(true)
    setSubmitError(null)
    try {
      const updated = await updatePurchaseWarranty(purchaseId, toWarrantyPayload(values))
      onUpdated(updated)
    } catch (error) {
      if (error instanceof AuthenticationError) {
        onAuthError()
        return
      }
      setSubmitError(updateWarrantyErrorMessage(error))
    } finally {
      isSavingRef.current = false
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <WarrantyFields
        idPrefix="warranty-edit"
        values={values}
        errors={errors}
        disabled={isSaving}
        onChange={(patch) => setValues((current) => ({ ...current, ...patch }))}
      />

      {submitError && <WarrantySubmitError message={submitError} />}

      <WarrantyFormActions
        isSaving={isSaving}
        canSubmit={isValid}
        submitLabel="Salvar alterações"
        savingLabel="Salvando..."
        onCancel={onCancel}
      />
    </form>
  )
}
