import { useEffect, useState } from 'react'
import { AlertCircle, Loader2, X } from 'lucide-react'
import type { DocumentExtraction } from '../../types/document.ts'
import {
  CUSTOM_CATEGORY_OPTION,
  isStandardCategory,
  PURCHASE_CATEGORIES,
} from '../../lib/categories.ts'
import { CATEGORY_MAX } from './purchase-form.ts'

export interface DocumentExtractionPanelProps {
  /** Dados extraídos pela IA, usados como valores iniciais dos inputs. */
  data: DocumentExtraction
  /** Fecha o painel sem aplicar nada (descarta as edições). */
  onClose: () => void
  /**
   * Aplica à compra os dados revisados (PATCH). Recebe exatamente o que o
   * usuário editou (ou o valor original, se não mexeu). Ausente = somente
   * leitura (sem edição).
   */
  onConfirm?: (data: DocumentExtraction) => void
  /** `true` enquanto a confirmação está em andamento. */
  isSaving?: boolean
  /** Mensagem de erro amigável exibida quando a confirmação falha. */
  confirmError?: string | null
}

/** Placeholder mostrado quando a IA não identificou o campo (valor null). */
const NOT_IDENTIFIED = 'Não identificado'

/**
 * Estado local dos inputs: tudo como string (o que o usuário digita).
 * `null` do backend vira string vazia — nunca um valor inventado.
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

const toFormValues = (data: DocumentExtraction): FormValues => ({
  productName: data.productName ?? '',
  brand: data.brand ?? '',
  model: data.model ?? '',
  purchaseDate: data.purchaseDate ?? '',
  price: data.price === null ? '' : String(data.price),
  store: data.store ?? '',
  warrantyMonths: data.warrantyMonths === null ? '' : String(data.warrantyMonths),
  // Campo ainda não extraído pela IA: ausente/null vira string vazia (nunca
  // um valor inventado). Editável na revisão.
  category: data.category ?? '',
})

/** Campo de texto vazio vira `null` (nunca string vazia). */
const textOrNull = (value: string) => {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Converte o formulário editado no payload tipado esperado pelo backend.
 * - texto vazio -> null
 * - data vazia -> null; senão mantém "YYYY-MM-DD"
 * - preço vazio -> null; senão número (não string)
 * - garantia vazia -> null; senão inteiro
 * - invoiceNumber NÃO é enviado: o schema de confirmação não o persiste.
 */
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
    // Mantido no estado por fidelidade à extração, mas não aplicado à compra.
    invoiceNumber: null,
    warrantyMonths: warranty === '' ? null : Number(warranty),
    // Revisável nesta etapa, mas ainda NÃO é enviado ao backend.
    category: textOrNull(values.category),
  }
}

interface FormErrors {
  productName?: string
  purchaseDate?: string
  price?: string
  warrantyMonths?: string
  category?: string
}

/** Validação básica de UX. O backend continua sendo a fonte de verdade. */
const validate = (values: FormValues): FormErrors => {
  const errors: FormErrors = {}

  if (values.productName.trim().length === 0) {
    errors.productName = 'Informe o nome do produto.'
  }

  const purchaseDate = values.purchaseDate.trim()
  if (
    purchaseDate !== '' &&
    Number.isNaN(new Date(`${purchaseDate}T00:00:00Z`).getTime())
  ) {
    errors.purchaseDate = 'Informe uma data válida.'
  }

  const price = values.price.trim()
  if (price !== '') {
    const numericPrice = Number(price)
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      errors.price = 'Informe um preço válido (não negativo).'
    }
  }

  const warranty = values.warrantyMonths.trim()
  if (warranty !== '') {
    const numericWarranty = Number(warranty)
    if (!Number.isInteger(numericWarranty) || numericWarranty <= 0) {
      errors.warrantyMonths = 'Informe um número inteiro de meses maior que zero.'
    }
  }

  if (values.category.trim().length > CATEGORY_MAX) {
    errors.category = `A categoria deve ter no máximo ${CATEGORY_MAX} caracteres.`
  }

  return errors
}

const hasErrors = (errors: FormErrors) => Object.keys(errors).length > 0
/**
 * Painel de revisão e edição dos dados extraídos da nota pela IA.
 *
 * Os valores começam preenchidos com o resultado da IA e podem ser corrigidos
 * pelo usuário. Nada é aplicado à compra enquanto o usuário digita: só o botão
 * "Usar estes dados" persiste, enviando os valores editados. Fechar descarta.
 */
export function DocumentExtractionPanel({
  data,
  onClose,
  onConfirm,
  isSaving = false,
  confirmError = null,
}: DocumentExtractionPanelProps) {
  const editable = onConfirm !== undefined
  const [values, setValues] = useState<FormValues>(() => toFormValues(data))
  const [errors, setErrors] = useState<FormErrors>({})
  // Categoria fora da lista (ou vazia) abre o texto livre; personalizada já
  // vinda da extração é representada como "Outra", sem sobrescrever o valor.
  const [isCustomCategory, setIsCustomCategory] = useState(
    () => data.category != null && data.category.trim() !== '' && !isStandardCategory(data.category),
  )

  const update = (field: keyof FormValues, value: string) => {
    setValues((current) => ({ ...current, [field]: value }))
    // Limpa o erro do campo assim que o usuário corrige (só existe erro para
    // os campos validados).
    setErrors((current) => {
      if (!(field in current)) return current
      const next = { ...current }
      delete next[field as keyof FormErrors]
      return next
    })
  }

  /** Alimenta `values.category` a partir do select (categoria da lista ou "Outra"). */
  const handleCategorySelect = (value: string) => {
    if (value === CUSTOM_CATEGORY_OPTION) {
      setIsCustomCategory(true)
      update('category', '')
      return
    }
    setIsCustomCategory(false)
    update('category', value)
  }

  const handleConfirmClick = () => {
    if (!onConfirm || isSaving) return
    const nextErrors = validate(values)
    setErrors(nextErrors)
    if (hasErrors(nextErrors)) return
    onConfirm(toPayload(values))
  }

  // Fecha com Esc e evita rolagem do fundo enquanto o painel está aberto.
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Não permite fechar no meio de um salvamento.
      if (event.key === 'Escape' && !isSaving) onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [onClose, isSaving])

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-slate-900/50 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="document-extraction-title"
      onClick={() => {
        if (!isSaving) onClose()
      }}
    >
      <div
        className="w-full max-w-lg rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Cabeçalho */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-5 sm:p-6">
          <div className="min-w-0">
            <h3
              id="document-extraction-title"
              className="text-base font-semibold text-slate-900 sm:text-lg"
            >
              Dados encontrados na nota
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {editable
                ? 'Confira e corrija os dados antes de aplicar à compra.'
                : 'Revise as informações identificadas pela IA.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            aria-label="Fechar"
            className="inline-flex shrink-0 cursor-pointer items-center justify-center rounded-lg border-slate-300 bg-white p-2 text-slate-500 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Campos extraídos — editáveis: começam com os valores da IA. */}
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 p-5 sm:grid-cols-2 sm:p-6">
          <TextField
            id="extraction-product"
            label="Produto"
            value={values.productName}
            placeholder="Não identificado"
            disabled={isSaving}
            error={errors.productName}
            onChange={(value) => update('productName', value)}
          />
          <TextField
            id="extraction-brand"
            label="Marca"
            value={values.brand}
            placeholder="Não identificado"
            disabled={isSaving}
            onChange={(value) => update('brand', value)}
          />
          <TextField
            id="extraction-model"
            label="Modelo"
            value={values.model}
            placeholder="Não identificado"
            disabled={isSaving}
            onChange={(value) => update('model', value)}
          />
          <TextField
            id="extraction-date"
            label="Data da compra"
            type="date"
            value={values.purchaseDate}
            disabled={isSaving}
            error={errors.purchaseDate}
            onChange={(value) => update('purchaseDate', value)}
          />
          <TextField
            id="extraction-price"
            label="Preço"
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={values.price}
            placeholder="Não identificado"
            disabled={isSaving}
            error={errors.price}
            onChange={(value) => update('price', value)}
          />
          <TextField
            id="extraction-store"
            label="Loja"
            value={values.store}
            placeholder="Não identificado"
            disabled={isSaving}
            onChange={(value) => update('store', value)}
          />

          {/* Categoria — select com a lista central + opção "Outra" (texto
              livre). Opcional neste fluxo: vazio continua "não informado". */}
          <div className="min-w-0">
            <label
              htmlFor="extraction-category"
              className="mb-1.5 block text-xs font-medium tracking-wide text-slate-500 uppercase"
            >
              Categoria
            </label>
            <select
              id="extraction-category"
              name="category"
              value={isCustomCategory ? CUSTOM_CATEGORY_OPTION : values.category}
              onChange={(event) => handleCategorySelect(event.target.value)}
              disabled={isSaving}
              aria-invalid={Boolean(errors.category)}
              className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:opacity-60 ${
                errors.category
                  ? 'border-red-300 focus-visible:border-red-400'
                  : 'border-slate-300 focus-visible:border-emerald-500'
              }`}
            >
              <option value="">{NOT_IDENTIFIED}</option>
              {PURCHASE_CATEGORIES.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
              <option value={CUSTOM_CATEGORY_OPTION}>{CUSTOM_CATEGORY_OPTION}</option>
            </select>
            {isCustomCategory && (
              <input
                id="extraction-category-custom"
                name="category-custom"
                type="text"
                value={values.category}
                onChange={(event) => update('category', event.target.value)}
                placeholder="Ex.: Instrumentos musicais"
                disabled={isSaving}
                aria-label="Categoria personalizada"
                aria-invalid={Boolean(errors.category)}
                aria-describedby={errors.category ? 'extraction-category-error' : undefined}
                className={`mt-2 w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:opacity-60 ${
                  errors.category
                    ? 'border-red-300 focus-visible:border-red-400'
                    : 'border-slate-300 focus-visible:border-emerald-500'
                }`}
              />
            )}
            {errors.category && (
              <p id="extraction-category-error" className="mt-1.5 text-xs text-red-600">
                {errors.category}
              </p>
            )}
          </div>

          {/* Número da nota: apenas informativo — não é aplicado à compra. */}
          <div className="min-w-0">
            <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">
              Número da nota
            </p>
            <p className="mt-1 text-sm break-words text-slate-900">
              {data.invoiceNumber ?? NOT_IDENTIFIED}
            </p>
            <p className="mt-1 text-xs text-slate-400">Ainda não é aplicado à compra.</p>
          </div>

          <TextField
            id="extraction-warranty"
            label="Garantia em meses"
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            value={values.warrantyMonths}
            placeholder="Não identificado"
            disabled={isSaving}
            error={errors.warrantyMonths}
            onChange={(value) => update('warrantyMonths', value)}
          />
        </div>

        {/* Erro da confirmação (mantém o painel aberto para tentar de novo). */}
        {confirmError && (
          <div
            role="alert"
            className="mx-5 flex items-start gap-2.5 rounded-lg border-red-200 bg-red-50 px-3.5 py-3 text-sm text-red-700 sm:mx-6"
          >
            <AlertCircle
              className="h-4 w-4 shrink-0 translate-y-0.5"
              aria-hidden="true"
            />
            <span>{confirmError}</span>
          </div>
        )}

        {/* Ações: aplicar os dados à compra ou apenas fechar. */}
        <div className="flex flex-col gap-3 border-t border-slate-100 p-5 sm:flex-row sm:justify-end sm:p-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="inline-flex w-full cursor-pointer items-center justify-center rounded-lg border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            Fechar
          </button>
          {onConfirm && (
            <button
              type="button"
              onClick={handleConfirmClick}
              disabled={isSaving}
              className="inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Salvando...</span>
                </>
              ) : (
                'Usar estes dados'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

interface TextFieldProps {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  type?: 'text' | 'date' | 'number'
  placeholder?: string
  disabled?: boolean
  error?: string
  inputMode?: 'text' | 'decimal' | 'numeric'
  step?: string
  min?: string
}

/** Campo de texto editável do painel, no padrão visual dos formulários do projeto. */
function TextField({
  id,
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  disabled = false,
  error,
  inputMode,
  step,
  min,
}: TextFieldProps) {
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
        disabled={disabled}
        inputMode={inputMode}
        step={step}
        min={min}
        aria-invalid={Boolean(error)}
        className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 disabled:opacity-60 ${
          error
            ? 'border-red-300 focus-visible:border-red-400'
            : 'border-slate-300 focus-visible:border-emerald-500'
        }`}
      />
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  )
}
