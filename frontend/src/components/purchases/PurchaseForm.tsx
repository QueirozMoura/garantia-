import { useState, type FormEvent } from 'react'
import { AlertCircle, Loader2, Save } from 'lucide-react'
import type { CreatePurchaseInput } from '../../types/purchase.ts'
import {
  CUSTOM_CATEGORY_OPTION,
  isStandardCategory,
  PURCHASE_CATEGORIES,
} from '../../lib/categories.ts'
import {
  validatePurchaseFields,
  toPurchasePayload,
  type PurchaseFormFields,
} from './purchase-form.ts'

export interface PurchaseFormProps {
  /** Valores iniciais (criação: vazio; edição: dados atuais da compra). */
  initialFields: PurchaseFormFields
  submitLabel: string
  submittingLabel?: string
  /** Texto do botão secundário. */
  cancelLabel?: string
  /** Mensagem de erro geral exibida acima do formulário. */
  formError?: string | null
  /** `true` enquanto a requisição de salvar está em andamento. */
  isSubmitting: boolean
  /** `true` após o sucesso (bloqueia novos envios). */
  isSuccess?: boolean
  onSubmit: (payload: CreatePurchaseInput) => void
  /**
   * Alternativa ao `onSubmit` que recebe os campos brutos do formulário (sem
   * converter em payload). Usada no fluxo guest para salvar o rascunho local.
   * Quando presente, tem prioridade sobre `onSubmit`.
   */
  onSubmitFields?: (fields: PurchaseFormFields) => void
  onCancel: () => void
}

/**
 * Formulário de compra compartilhado entre criação e edição — mesma validação,
 * mesmos campos e mesmos estilos. O envio real (POST/PUT) é decidido pelo pai.
 */
export function PurchaseForm({
  initialFields,
  submitLabel,
  submittingLabel = 'Salvando...',
  cancelLabel = 'Cancelar',
  formError = null,
  isSubmitting,
  isSuccess = false,
  onSubmit,
  onSubmitFields,
  onCancel,
}: PurchaseFormProps) {
  const [fields, setFields] = useState<PurchaseFormFields>(initialFields)
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof PurchaseFormFields, string>>
  >({})
  // Um valor existente fora da lista (ex.: "electronics") é tratado como
  // personalizado, para o select representá-lo sem sobrescrevê-lo.
  const [isCustomCategory, setIsCustomCategory] = useState(
    () => initialFields.category.trim() !== '' && !isStandardCategory(initialFields.category),
  )

  function setField(name: keyof PurchaseFormFields, value: string) {
    setFields((current) => ({ ...current, [name]: value }))
  }

  /**
   * `fields.category` é a única fonte da categoria enviada à API. O select e o
   * campo personalizado apenas o alimentam:
   * - categoria da lista -> grava o próprio valor e esconde o texto livre;
   * - "Outra" -> mostra o texto livre e usa o que for digitado;
   * - vazio -> categoria vazia (a validação existente decide se é válido).
   */
  function handleCategoryChange(value: string) {
    if (value === CUSTOM_CATEGORY_OPTION) {
      setIsCustomCategory(true)
      // Limpa para o usuário digitar a categoria personalizada.
      setField('category', '')
      return
    }
    setIsCustomCategory(false)
    setField('category', value)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isSubmitting || isSuccess) return
    const errors = validatePurchaseFields(fields)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    if (onSubmitFields) {
      onSubmitFields(fields)
      return
    }
    onSubmit(toPurchasePayload(fields))
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {formError && (
        <div
          role="alert"
          className="flex items-start gap-2.5 rounded-lg border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{formError}</span>
        </div>
      )}

      <Field
        id="productName"
        label="Nome do produto"
        required
        value={fields.productName}
        onChange={(value) => setField('productName', value)}
        placeholder="Ex.: Notebook Dell XPS 15"
        error={fieldErrors.productName}
      />

      {/* Marca e Modelo */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          id="brand"
          label="Marca"
          value={fields.brand}
          onChange={(value) => setField('brand', value)}
          placeholder="Ex.: Dell"
          error={fieldErrors.brand}
        />
        <Field
          id="model"
          label="Modelo"
          value={fields.model}
          onChange={(value) => setField('model', value)}
          placeholder="Ex.: XPS 15 9530"
          error={fieldErrors.model}
        />
      </div>

      {/* Número de série e Loja */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          id="serialNumber"
          label="Número de série"
          value={fields.serialNumber}
          onChange={(value) => setField('serialNumber', value)}
          placeholder="Opcional"
          error={fieldErrors.serialNumber}
        />
        <Field
          id="store"
          label="Loja"
          value={fields.store}
          onChange={(value) => setField('store', value)}
          placeholder="Ex.: Magazine Luiza"
          error={fieldErrors.store}
        />
      </div>

      {/* Data da compra e Preço */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field
          id="purchaseDate"
          label="Data da compra"
          type="date"
          required
          value={fields.purchaseDate}
          onChange={(value) => setField('purchaseDate', value)}
          error={fieldErrors.purchaseDate}
        />
        <Field
          id="price"
          label="Preço (R$)"
          type="text"
          inputMode="decimal"
          required
          value={fields.price}
          onChange={(value) => setField('price', value)}
          placeholder="Ex.: 8749.90"
          error={fieldErrors.price}
        />
      </div>

      {/* Categoria */}
      <div className="space-y-5 sm:max-w-[calc(50%-0.625rem)]">
        <div className="min-w-0">
          <label
            htmlFor="category"
            className="mb-1.5 block text-sm font-medium text-slate-700"
          >
            Categoria <span className="text-red-500">*</span>
          </label>
          <select
            id="category"
            name="category"
            value={isCustomCategory ? CUSTOM_CATEGORY_OPTION : fields.category}
            onChange={(event) => handleCategoryChange(event.target.value)}
            aria-invalid={Boolean(fieldErrors.category)}
            aria-describedby={fieldErrors.category ? 'category-error' : undefined}
            className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
              fieldErrors.category
                ? 'border-red-300 focus-visible:border-red-400'
                : 'border-slate-300 focus-visible:border-emerald-500'
            }`}
          >
            <option value="">Selecione uma categoria</option>
            {PURCHASE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
            <option value={CUSTOM_CATEGORY_OPTION}>{CUSTOM_CATEGORY_OPTION}</option>
          </select>
          {fieldErrors.category && (
            <p id="category-error" className="mt-1.5 text-xs text-red-600">
              {fieldErrors.category}
            </p>
          )}
        </div>

        {isCustomCategory && (
          <Field
            id="category-custom"
            label="Categoria personalizada"
            required
            value={fields.category}
            onChange={(value) => setField('category', value)}
            placeholder="Ex.: Instrumentos musicais"
            error={fieldErrors.category}
          />
        )}
      </div>

      {/* Ações */}
      <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
        <button
          type="button"
          onClick={onCancel}
          disabled={isSubmitting}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {cancelLabel}
        </button>

        <button
          type="submit"
          disabled={isSubmitting || isSuccess}
          className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              <span>{submittingLabel}</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4" aria-hidden="true" />
              <span>{submitLabel}</span>
            </>
          )}
        </button>
      </div>
    </form>
  )
}

interface FieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'date'
  placeholder?: string
  required?: boolean
  error?: string
  inputMode?: 'text' | 'decimal'
}

/** Campo do formulário de compra, no padrão visual do projeto. */
function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
  error,
  inputMode,
}: FieldProps) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
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
        className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
          error
            ? 'border-red-300 focus-visible:border-red-400'
            : 'border-slate-300 focus-visible:border-emerald-500'
        }`}
      />
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  )
}
