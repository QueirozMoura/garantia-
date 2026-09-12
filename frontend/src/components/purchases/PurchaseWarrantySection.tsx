import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, RefreshCw, ShieldCheck, ShieldPlus, ShieldX } from 'lucide-react'
import {
  getPurchaseWarranty,
  createPurchaseWarranty,
  AuthenticationError,
  ApiError,
} from '../../lib/api.ts'
import { useAuth } from '../../contexts/auth-context.ts'
import { formatDateBR } from '../../lib/formatters.ts'
import type { Warranty } from '../../types/warranty.ts'

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'success'; warranty: Warranty | null }

const FALLBACK_ERROR = 'Não foi possível carregar a garantia. Tente novamente.'
const FALLBACK_SAVE_ERROR = 'Não foi possível salvar a garantia. Tente novamente.'

export interface PurchaseWarrantySectionProps {
  purchaseId: string
}

/** Compara endDate com o agora em UTC, sem conversão de fuso nem libs novas. */
function isWarrantyActive(endDate: string): boolean {
  return new Date(endDate).getTime() >= Date.now()
}

export function PurchaseWarrantySection({ purchaseId }: PurchaseWarrantySectionProps) {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [state, setState] = useState<FetchState>({ status: 'loading' })
  const [reloadKey, setReloadKey] = useState(0)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    let isActive = true
    const load = async () => {
      try {
        const warranty = await getPurchaseWarranty(purchaseId)
        if (isActive) setState({ status: 'success', warranty })
      } catch (error) {
        if (!isActive) return
        if (error instanceof AuthenticationError) {
          setUser(null)
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
  }, [purchaseId, reloadKey, navigate, setUser])

  const handleRetry = useCallback(() => {
    setState({ status: 'loading' })
    setReloadKey((key) => key + 1)
  }, [])

  const handleCreated = useCallback((warranty: Warranty) => {
    setState({ status: 'success', warranty })
    setShowForm(false)
  }, [])

  return (
    <section className="rounded-xl border-slate-200 bg-white p-5 sm:p-6">
      <h3 className="text-base font-semibold text-slate-900">Garantia</h3>

      <div className="mt-5">
        {state.status === 'loading' && <WarrantySkeleton />}

        {state.status === 'error' && (
          <WarrantyErrorState message={state.message} onRetry={handleRetry} />
        )}

        {state.status === 'success' && state.warranty && (
          <WarrantyCard warranty={state.warranty} />
        )}

        {state.status === 'success' && !state.warranty && !showForm && (
          <WarrantyEmptyState onAdd={() => setShowForm(true)} />
        )}

        {state.status === 'success' && !state.warranty && showForm && (
          <WarrantyForm
            purchaseId={purchaseId}
            onCancel={() => setShowForm(false)}
            onCreated={handleCreated}
            onAuthError={() => {
              setUser(null)
              navigate('/login', { replace: true })
            }}
          />
        )}
      </div>
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
function WarrantyCard({ warranty }: { warranty: Warranty }) {
  const active = isWarrantyActive(warranty.endDate)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${
            active ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
          }`}
        >
          {active ? (
            <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          ) : (
            <ShieldX className="h-5 w-5" aria-hidden="true" />
          )}
        </div>
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
            active
              ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
              : 'bg-slate-100 text-slate-600 ring-slate-500/20'
          }`}
        >
          {active ? 'Ativa' : 'Vencida'}
        </span>
      </div>

      <dl className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        <WarrantyItem label="Duração" value={`${warranty.durationMonths} meses`} />
        <WarrantyItem label="Início" value={formatDateBR(warranty.startDate)} />
        <WarrantyItem label="Término" value={formatDateBR(warranty.endDate)} />
      </dl>
    </div>
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
      <dd className="mt-1 truncate text-sm text-slate-900">{value}</dd>
    </div>
  )
}

/** Estado sem garantia + botão para abrir o formulário. */
function WarrantyEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl border-dashed border-slate-300 bg-white p-6 text-center sm:p-8">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
        <ShieldPlus className="h-6 w-6" aria-hidden="true" />
      </div>
      <p className="mx-auto mt-4 max-w-md text-sm text-slate-500">
        Esta compra ainda não possui garantia
      </p>
      <div className="mt-5 flex justify-center">
        <button
          type="button"
          onClick={onAdd}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600"
        >
          <ShieldPlus className="h-4 w-4" aria-hidden="true" />
          <span>Adicionar garantia</span>
        </button>
      </div>
    </div>
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
  const [durationMonths, setDurationMonths] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Validação derivada — usada para bloquear o envio e exibir mensagens.
  const durationValue = Number(durationMonths)
  const durationError = useMemo(() => {
    if (!durationMonths) return 'Informe a duração em meses.'
    if (!Number.isInteger(durationValue) || durationValue <= 0) {
      return 'A duração deve ser um número inteiro positivo.'
    }
    return null
  }, [durationMonths, durationValue])

  const startDateError = startDate ? null : 'Informe a data de início.'
  const endDateError = endDate ? null : 'Informe a data de término.'
  const rangeError =
    startDate && endDate && endDate < startDate
      ? 'A data de término não pode ser anterior à data de início.'
      : null

  const isValid = !durationError && !startDateError && !endDateError && !rangeError

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!isValid || isSaving) return

    setIsSaving(true)
    setSubmitError(null)
    try {
      const warranty = await createPurchaseWarranty(purchaseId, {
        durationMonths: durationValue,
        startDate,
        endDate,
      })
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
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label
            htmlFor="warranty-duration"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Duração da garantia (meses)
          </label>
          <input
            id="warranty-duration"
            name="durationMonths"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={durationMonths}
            onChange={(event) => setDurationMonths(event.target.value)}
            placeholder="Ex.: 12"
            aria-invalid={Boolean(durationError)}
            className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
              durationError
                ? 'border-red-300 focus-visible:border-red-400'
                : 'border-slate-300 focus-visible:border-emerald-500'
            }`}
          />
          {durationError && (
            <p className="mt-1.5 text-xs text-red-600">{durationError}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="warranty-start"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Data de início
          </label>
          <input
            id="warranty-start"
            name="startDate"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            aria-invalid={Boolean(startDateError)}
            className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
              startDateError
                ? 'border-red-300 focus-visible:border-red-400'
                : 'border-slate-300 focus-visible:border-emerald-500'
            }`}
          />
          {startDateError && (
            <p className="mt-1.5 text-xs text-red-600">{startDateError}</p>
          )}
        </div>

        <div>
          <label
            htmlFor="warranty-end"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Data de término
          </label>
          <input
            id="warranty-end"
            name="endDate"
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            aria-invalid={Boolean(endDateError || rangeError)}
            className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
              endDateError || rangeError
                ? 'border-red-300 focus-visible:border-red-400'
                : 'border-slate-300 focus-visible:border-emerald-500'
            }`}
          />
          {endDateError && <p className="mt-1.5 text-xs text-red-600">{endDateError}</p>}
          {rangeError && <p className="mt-1.5 text-xs text-red-600">{rangeError}</p>}
        </div>
      </div>

      {submitError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0 translate-y-0.5" aria-hidden="true" />
          <span>{submitError}</span>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="inline-flex cursor-pointer items-center justify-center rounded-lg border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!isValid || isSaving}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Salvando...' : 'Salvar garantia'}
        </button>
      </div>
    </form>
  )
}
