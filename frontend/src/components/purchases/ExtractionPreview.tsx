import { useEffect, useRef, useState } from 'react'
import { AlertCircle, CheckCircle2, Info, Loader2 } from 'lucide-react'
import type { DocumentExtraction } from '../../types/document.ts'
import {
  CATEGORY_MAX,
  isValidPurchaseDate,
  TEXT_MAX,
  validatePriceValue,
} from './purchase-form.ts'
import { NOT_IDENTIFIED } from './purchase-document.ts'

export interface ExtractionPreviewProps {
  /** Dados retornados pela IA (podem conter nulls). Não é mutado. */
  data: DocumentExtraction
  /** Recebe os dados revisados (apenas estado local — nada é salvo aqui). */
  onContinue: (reviewed: DocumentExtraction) => void
  /** Volta para a etapa anterior sem salvar/recriar nada. */
  onBack: () => void
  /**
   * `true` enquanto outra requisição do fluxo está em andamento. Bloqueia o
   * "Continuar" (sem chamar API) e mostra o loading no botão.
   */
  isSubmitting?: boolean
}

/**
 * Estado local do formulário de revisão: tudo como string (o que o usuário
 * digita). `null` do backend vira string vazia — nunca um valor inventado.
 */
interface FormValues {
  productName: string
  brand: string
  model: string
  purchaseDate: string
  price: string
  store: string
  warrantyMonths: string
  category: string
}

type FieldErrors = Partial<Record<keyof FormValues, string>>

const toFormValues = (data: DocumentExtraction): FormValues => ({
  productName: data.productName ?? '',
  brand: data.brand ?? '',
  model: data.model ?? '',
  // Mantém internamente o formato YYYY-MM-DD (input type="date").
  purchaseDate: data.purchaseDate ?? '',
  price: data.price === null ? '' : String(data.price),
  store: data.store ?? '',
  warrantyMonths: data.warrantyMonths === null ? '' : String(data.warrantyMonths),
  // Campo ainda não extraído pela IA: ausente/null vira string vazia (nunca
  // um valor inventado). O usuário pode preencher/editar na revisão.
  category: data.category ?? '',
})

const textOrNull = (value: string) => {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/** Converte o formulário revisado no payload tipado esperado (estado local). */
const toPayload = (values: FormValues): DocumentExtraction => {
  const price = values.price.trim()
  const warranty = values.warrantyMonths.trim()
  return {
    productName: textOrNull(values.productName),
    brand: textOrNull(values.brand),
    model: textOrNull(values.model),
    purchaseDate: values.purchaseDate.trim() || null,
    price: price === '' ? null : Number(price),
    store: textOrNull(values.store),
    // invoiceNumber NÃO é editável nem enviado — permanece somente leitura.
    invoiceNumber: null,
    warrantyMonths: warranty === '' ? null : Number(warranty),
    // Revisável nesta etapa, mas ainda NÃO é enviado ao backend (api.ts não a
    // inclui no PATCH). Vazio vira null — nunca um valor inventado.
    category: textOrNull(values.category),
  }
}

/**
 * Validação reutilizando as mesmas regras do formulário de compra / painel de
 * extração. O backend continua sendo a fonte de verdade.
 */
const validate = (values: FormValues): FieldErrors => {
  const errors: FieldErrors = {}

  const productName = values.productName.trim()
  if (!productName) {
    errors.productName = 'Informe o nome do produto.'
  } else if (productName.length > TEXT_MAX) {
    errors.productName = `O nome deve ter no máximo ${TEXT_MAX} caracteres.`
  }

  if (values.brand.trim().length > TEXT_MAX) {
    errors.brand = `A marca deve ter no máximo ${TEXT_MAX} caracteres.`
  }
  if (values.model.trim().length > TEXT_MAX) {
    errors.model = `O modelo deve ter no máximo ${TEXT_MAX} caracteres.`
  }
  if (values.store.trim().length > TEXT_MAX) {
    errors.store = `A loja deve ter no máximo ${TEXT_MAX} caracteres.`
  }
  if (values.category.trim().length > CATEGORY_MAX) {
    errors.category = `A categoria deve ter no máximo ${CATEGORY_MAX} caracteres.`
  }

  const purchaseDate = values.purchaseDate.trim()
  if (!purchaseDate) {
    errors.purchaseDate = 'Informe a data da compra.'
  } else if (!isValidPurchaseDate(purchaseDate)) {
    errors.purchaseDate = 'Informe uma data válida.'
  }

  // Reutiliza a validação de preço do formulário de compra (mesmo limite).
  const priceError = validatePriceValue(values.price)
  if (priceError) errors.price = priceError
  const warranty = values.warrantyMonths.trim()
  if (warranty !== '') {
    const numericWarranty = Number(warranty)
    if (!Number.isInteger(numericWarranty) || numericWarranty <= 0) {
      errors.warrantyMonths = 'Informe um número inteiro de meses maior que zero.'
    }
  }

  return errors
}

const hasErrors = (errors: FieldErrors) => Object.keys(errors).length > 0
/** Id do input de cada campo, para associar erro/foco ao campo correto. */
const REVIEW_FIELD_IDS: Record<keyof FormValues, string> = {
  productName: 'review-product',
  brand: 'review-brand',
  model: 'review-model',
  purchaseDate: 'review-date',
  price: 'review-price',
  store: 'review-store',
  warrantyMonths: 'review-warranty',
  category: 'review-category',
}

/**
 * Etapa de revisão dos dados extraídos da nota fiscal.
 *
 * Os campos começam preenchidos com o resultado da IA e podem ser corrigidos.
 * Nada é salvo no backend aqui: as alterações ficam apenas no estado local e,
 * ao "Continuar", os dados revisados são repassados ao fluxo (próxima etapa).
 * O `invoiceNumber` é somente leitura e nunca é enviado.
 */
export function ExtractionPreview({
  data,
  onContinue,
  onBack,
  isSubmitting = false,
}: ExtractionPreviewProps) {
  const [values, setValues] = useState<FormValues>(() => toFormValues(data))
  const [errors, setErrors] = useState<FieldErrors>({})
  // Guarda síncrona: o "Continuar" não chama API, mas evita navegação
  // duplicada em dois cliques rápidos.
  const isContinuingRef = useRef(false)
  // Campo destacado com erro, para mover o foco após a validação falhar.
  const firstErrorField = Object.keys(errors)[0] as keyof FormValues | undefined
  useEffect(() => {
    if (firstErrorField) {
      document.getElementById(REVIEW_FIELD_IDS[firstErrorField])?.focus()
    }
  }, [firstErrorField])

  const update = (field: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    setErrors((current) => {
      if (!(field in current)) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const handleContinue = () => {
    if (isContinuingRef.current || isSubmitting) return
    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (hasErrors(nextErrors)) return
    // Apenas prepara os dados revisados localmente para a próxima etapa.
    // Nenhuma chamada de API acontece aqui.
    isContinuingRef.current = true
    onContinue(toPayload(values))
  }

  return (
    <div className="rounded-xl border-slate-200 bg-white p-5 sm:p-6">
      <h3 className="text-base font-semibold text-slate-900">
        Confira os dados da sua compra
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        A IA preencheu estes dados com base na nota fiscal. Revise as informações antes de
        continuar.
      </p>

      <div className="mt-5 grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
        <ReviewField
          id="review-product"
          label="Produto"
          value={values.productName}
          placeholder="Ex.: Notebook Dell XPS 15"
          error={errors.productName}
          onChange={(value) => update('productName', value)}
        />
        <ReviewField
          id="review-brand"
          label="Marca"
          value={values.brand}
          placeholder={NOT_IDENTIFIED}
          error={errors.brand}
          onChange={(value) => update('brand', value)}
        />
        <ReviewField
          id="review-model"
          label="Modelo"
          value={values.model}
          placeholder={NOT_IDENTIFIED}
          error={errors.model}
          onChange={(value) => update('model', value)}
        />
        <ReviewField
          id="review-date"
          label="Data da compra"
          type="date"
          value={values.purchaseDate}
          error={errors.purchaseDate}
          onChange={(value) => update('purchaseDate', value)}
        />
        <ReviewField
          id="review-price"
          label="Valor (R$)"
          inputMode="decimal"
          value={values.price}
          placeholder="Ex.: 2999.90"
          error={errors.price}
          onChange={(value) => update('price', value)}
        />
        <ReviewField
          id="review-store"
          label="Loja"
          value={values.store}
          placeholder={NOT_IDENTIFIED}
          error={errors.store}
          onChange={(value) => update('store', value)}
        />

        {/* Categoria — texto livre nesta etapa (a IA ainda não a extrai e ela
            ainda não é enviada ao backend). O usuário pode preencher/editar. */}
        <ReviewField
          id="review-category"
          label="Categoria"
          value={values.category}
          placeholder="Ex.: Informática"
          error={errors.category}
          onChange={(value) => update('category', value)}
        />

        {/* Garantia — deixa explícito que o valor é em meses. */}
        <div className="min-w-0">
          <label
            htmlFor="review-warranty"
            className="mb-1.5 block text-xs font-medium tracking-wide text-slate-500 uppercase"
          >
            Garantia
          </label>
          <div className="flex items-center gap-2">
            <input
              id="review-warranty"
              name="warrantyMonths"
              aria-describedby={
                errors.warrantyMonths ? 'review-warranty-error' : undefined
              }
              type="number"
              inputMode="numeric"
              step="1"
              min="1"
              value={values.warrantyMonths}
              onChange={(event) => update('warrantyMonths', event.target.value)}
              placeholder={NOT_IDENTIFIED}
              aria-invalid={Boolean(errors.warrantyMonths)}
              className={`w-full min-w-0 rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                errors.warrantyMonths
                  ? 'border-red-300 focus-visible:border-red-400'
                  : 'border-slate-300 focus-visible:border-emerald-500'
              }`}
            />
            <span className="shrink-0 text-sm text-slate-500">meses</span>
          </div>
          {errors.warrantyMonths && (
            <p id="review-warranty-error" className="mt-1.5 text-xs text-red-600">
              {errors.warrantyMonths}
            </p>
          )}
        </div>

        {/* Número da nota — somente leitura, visualmente distinto. */}
        <div className="min-w-0">
          <p className="mb-1.5 text-xs font-medium tracking-wide text-slate-500 uppercase">
            Número da nota
          </p>
          <div className="flex items-center gap-2 rounded-lg border-dashed border-slate-300 bg-slate-50 px-3.5 py-2.5">
            <span className="min-w-0 truncate text-sm text-slate-700">
              {data.invoiceNumber ?? NOT_IDENTIFIED}
            </span>
          </div>
          <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-400">
            <Info className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span>Este dado será utilizado futuramente.</span>
          </p>
        </div>
      </div>

      {hasErrors(errors) && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2.5 rounded-lg border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
        >
          <AlertCircle className="h-4 w-4 shrink-0 translate-y-0.5" aria-hidden="true" />
          <span>Revise os campos destacados antes de continuar.</span>
        </div>
      )}

      <p className="mt-5 text-xs text-slate-400">
        Nada é salvo nesta etapa — estes dados ainda não foram aplicados à compra.
      </p>

      <div className="mt-5 flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 sm:w-auto"
        >
          Voltar
        </button>
        <button
          type="button"
          onClick={handleContinue}
          disabled={isSubmitting}
          className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
        >
          {isSubmitting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
          )}
          <span>{isSubmitting ? 'Aguarde...' : 'Continuar'}</span>
        </button>
      </div>
    </div>
  )
}

interface ReviewFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'date'
  placeholder?: string
  error?: string
  inputMode?: 'text' | 'decimal'
}

/** Campo editável do formulário de revisão, no padrão visual do projeto. */
function ReviewField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  error,
  inputMode,
}: ReviewFieldProps) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-medium tracking-wide text-slate-500 uppercase"
      >
        {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
          error
            ? 'border-red-300 focus-visible:border-red-400'
            : 'border-slate-300 focus-visible:border-emerald-500'
        }`}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-xs text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
