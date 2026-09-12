import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Loader2, AlertCircle, CheckCircle2, Save } from 'lucide-react'
import { createPurchase, AuthenticationError, ApiError } from '../lib/api.ts'
import { useAuth } from '../contexts/auth-context.ts'
import type { CreatePurchaseInput } from '../types/purchase.ts'

/**
 * Regras espelhadas de backend/src/modules/purchases.schemas.ts (createPurchaseSchema).
 * Qualquer mudança aqui deve acompanhar o schema real do backend.
 */
const PRODUCT_NAME_MAX = 255
const OPTIONAL_TEXT_MAX = 255
const CATEGORY_MAX = 100
const PRICE_MAX = 9999.99
const CENT = 0.01

interface FormFields {
  productName: string
  brand: string
  model: string
  serialNumber: string
  store: string
  purchaseDate: string
  price: string
  category: string
}

type FieldErrors = Partial<Record<keyof FormFields, string>>

const INITIAL_FIELDS: FormFields = {
  productName: '',
  brand: '',
  model: '',
  serialNumber: '',
  store: '',
  purchaseDate: '',
  price: '',
  category: '',
}

const FALLBACK_ERROR = 'Não foi possível cadastrar a compra. Tente novamente.'

/** Valida "YYYY-MM-DD" como data de calendário real, sem drift de fuso (UTC). */
function isValidPurchaseDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

/** Converte a string do input para número, tratando vírgula decimal (pt-BR). */
function parsePrice(value: string): number {
  return Number.parseFloat(value.trim().replace(',', '.'))
}
export function AddPurchase() {
  const navigate = useNavigate()
  const { setUser } = useAuth()
  const [fields, setFields] = useState<FormFields>(INITIAL_FIELDS)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)

  function setField(name: keyof FormFields, value: string) {
    setFields((current) => ({ ...current, [name]: value }))
  }

  /** Valida espelhando as regras reais do createPurchaseSchema. */
  function validate(): boolean {
    const errors: FieldErrors = {}
    const productName = fields.productName.trim()
    const category = fields.category.trim()
    const optionalLimit = (value: string) => value.trim().length > OPTIONAL_TEXT_MAX

    if (!productName) {
      errors.productName = 'Informe o nome do produto.'
    } else if (productName.length > PRODUCT_NAME_MAX) {
      errors.productName = `O nome deve ter no máximo ${PRODUCT_NAME_MAX} caracteres.`
    }

    if (optionalLimit(fields.brand)) {
      errors.brand = `A marca deve ter no máximo ${OPTIONAL_TEXT_MAX} caracteres.`
    }
    if (optionalLimit(fields.model)) {
      errors.model = `O modelo deve ter no máximo ${OPTIONAL_TEXT_MAX} caracteres.`
    }
    if (optionalLimit(fields.serialNumber)) {
      errors.serialNumber = `O número de série deve ter no máximo ${OPTIONAL_TEXT_MAX} caracteres.`
    }
    if (optionalLimit(fields.store)) {
      errors.store = `A loja deve ter no máximo ${OPTIONAL_TEXT_MAX} caracteres.`
    }

    if (!fields.purchaseDate) {
      errors.purchaseDate = 'Informe a data da compra.'
    } else if (!isValidPurchaseDate(fields.purchaseDate)) {
      errors.purchaseDate = 'Informe uma data válida.'
    }

    if (!fields.price.trim()) {
      errors.price = 'Informe o preço.'
    } else {
      const price = parsePrice(fields.price)
      if (Number.isNaN(price) || !Number.isFinite(price)) {
        errors.price = 'Informe um preço válido.'
      } else if (price < 0) {
        errors.price = 'O preço não pode ser negativo.'
      } else if (price > PRICE_MAX) {
        errors.price = `O preço deve ser no máximo ${PRICE_MAX.toFixed(2)}.`
      } else if (Math.abs(price / CENT - Math.round(price / CENT)) > 1e-6) {
        errors.price = 'O preço deve ter no máximo 2 casas decimais.'
      }
    }

    if (!category) {
      errors.category = 'Informe a categoria.'
    } else if (category.length > CATEGORY_MAX) {
      errors.category = `A categoria deve ter no máximo ${CATEGORY_MAX} caracteres.`
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setFormError(null)

    if (isSubmitting || isSuccess) return
    if (!validate()) return

    // Corpo exatamente como o backend aceita: sem campos extras (strictObject).
    const payload: CreatePurchaseInput = {
      productName: fields.productName.trim(),
      purchaseDate: fields.purchaseDate,
      price: parsePrice(fields.price),
      category: fields.category.trim(),
    }
    const brand = fields.brand.trim()
    const model = fields.model.trim()
    const serialNumber = fields.serialNumber.trim()
    const store = fields.store.trim()
    if (brand) payload.brand = brand
    if (model) payload.model = model
    if (serialNumber) payload.serialNumber = serialNumber
    if (store) payload.store = store

    setIsSubmitting(true)
    try {
      await createPurchase(payload)
      // Só considera a compra criada após resposta bem-sucedida da API.
      setIsSuccess(true)
      navigate('/purchases', { replace: true })
    } catch (error) {
      if (error instanceof AuthenticationError) {
        // Token inválido/expirado: segue o padrão global e volta ao login.
        setUser(null)
        navigate('/login', { replace: true })
        return
      }
      // Mensagem amigável; nunca expõe stack trace ou detalhes internos.
      const message = error instanceof ApiError ? error.message : FALLBACK_ERROR
      setFormError(message)
      setIsSubmitting(false)
    }
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

      <div className="rounded-xl border-slate-200 bg-white p-5 sm:p-6">
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

          {isSuccess && (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-lg border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-700"
            >
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Compra cadastrada com sucesso! Redirecionando…</span>
            </div>
          )}

          {/* Nome do produto */}
          <div>
            <label
              htmlFor="productName"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Nome do produto <span className="text-red-500">*</span>
            </label>
            <input
              id="productName"
              name="productName"
              type="text"
              value={fields.productName}
              onChange={(event) => setField('productName', event.target.value)}
              placeholder="Ex.: Notebook Dell XPS 15"
              aria-invalid={Boolean(fieldErrors.productName)}
              className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                fieldErrors.productName
                  ? 'border-red-300 focus-visible:border-red-400'
                  : 'border-slate-300 focus-visible:border-emerald-500'
              }`}
            />
            {fieldErrors.productName && (
              <p className="mt-1.5 text-xs text-red-600">{fieldErrors.productName}</p>
            )}
          </div>

          {/* Marca e Modelo */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="brand"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Marca
              </label>
              <input
                id="brand"
                name="brand"
                type="text"
                value={fields.brand}
                onChange={(event) => setField('brand', event.target.value)}
                placeholder="Ex.: Dell"
                aria-invalid={Boolean(fieldErrors.brand)}
                className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                  fieldErrors.brand
                    ? 'border-red-300 focus-visible:border-red-400'
                    : 'border-slate-300 focus-visible:border-emerald-500'
                }`}
              />
              {fieldErrors.brand && (
                <p className="mt-1.5 text-xs text-red-600">{fieldErrors.brand}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="model"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Modelo
              </label>
              <input
                id="model"
                name="model"
                type="text"
                value={fields.model}
                onChange={(event) => setField('model', event.target.value)}
                placeholder="Ex.: XPS 15 9530"
                aria-invalid={Boolean(fieldErrors.model)}
                className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                  fieldErrors.model
                    ? 'border-red-300 focus-visible:border-red-400'
                    : 'border-slate-300 focus-visible:border-emerald-500'
                }`}
              />
              {fieldErrors.model && (
                <p className="mt-1.5 text-xs text-red-600">{fieldErrors.model}</p>
              )}
            </div>
          </div>
          {/* Número de série e Loja */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="serialNumber"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Número de série
              </label>
              <input
                id="serialNumber"
                name="serialNumber"
                type="text"
                value={fields.serialNumber}
                onChange={(event) => setField('serialNumber', event.target.value)}
                placeholder="Opcional"
                aria-invalid={Boolean(fieldErrors.serialNumber)}
                className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                  fieldErrors.serialNumber
                    ? 'border-red-300 focus-visible:border-red-400'
                    : 'border-slate-300 focus-visible:border-emerald-500'
                }`}
              />
              {fieldErrors.serialNumber && (
                <p className="mt-1.5 text-xs text-red-600">{fieldErrors.serialNumber}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="store"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Loja
              </label>
              <input
                id="store"
                name="store"
                type="text"
                value={fields.store}
                onChange={(event) => setField('store', event.target.value)}
                placeholder="Ex.: Magazine Luiza"
                aria-invalid={Boolean(fieldErrors.store)}
                className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                  fieldErrors.store
                    ? 'border-red-300 focus-visible:border-red-400'
                    : 'border-slate-300 focus-visible:border-emerald-500'
                }`}
              />
              {fieldErrors.store && (
                <p className="mt-1.5 text-xs text-red-600">{fieldErrors.store}</p>
              )}
            </div>
          </div>

          {/* Data da compra e Preço */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label
                htmlFor="purchaseDate"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Data da compra <span className="text-red-500">*</span>
              </label>
              <input
                id="purchaseDate"
                name="purchaseDate"
                type="date"
                value={fields.purchaseDate}
                onChange={(event) => setField('purchaseDate', event.target.value)}
                aria-invalid={Boolean(fieldErrors.purchaseDate)}
                className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                  fieldErrors.purchaseDate
                    ? 'border-red-300 focus-visible:border-red-400'
                    : 'border-slate-300 focus-visible:border-emerald-500'
                }`}
              />
              {fieldErrors.purchaseDate && (
                <p className="mt-1.5 text-xs text-red-600">{fieldErrors.purchaseDate}</p>
              )}
            </div>

            <div>
              <label
                htmlFor="price"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Preço (R$) <span className="text-red-500">*</span>
              </label>
              <input
                id="price"
                name="price"
                type="text"
                inputMode="decimal"
                value={fields.price}
                onChange={(event) => setField('price', event.target.value)}
                placeholder="Ex.: 8749.90"
                aria-invalid={Boolean(fieldErrors.price)}
                className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                  fieldErrors.price
                    ? 'border-red-300 focus-visible:border-red-400'
                    : 'border-slate-300 focus-visible:border-emerald-500'
                }`}
              />
              {fieldErrors.price && (
                <p className="mt-1.5 text-xs text-red-600">{fieldErrors.price}</p>
              )}
            </div>
          </div>
          {/* Categoria */}
          <div className="sm:max-w-[calc(50%-0.625rem)]">
            <label
              htmlFor="category"
              className="mb-1.5 block text-sm font-medium text-slate-700"
            >
              Categoria <span className="text-red-500">*</span>
            </label>
            <input
              id="category"
              name="category"
              type="text"
              value={fields.category}
              onChange={(event) => setField('category', event.target.value)}
              placeholder="Ex.: Informática"
              aria-invalid={Boolean(fieldErrors.category)}
              className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${
                fieldErrors.category
                  ? 'border-red-300 focus-visible:border-red-400'
                  : 'border-slate-300 focus-visible:border-emerald-500'
              }`}
            />
            {fieldErrors.category && (
              <p className="mt-1.5 text-xs text-red-600">{fieldErrors.category}</p>
            )}
          </div>

          {/* Ações */}
          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => navigate('/purchases')}
              disabled={isSubmitting}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={isSubmitting || isSuccess}
              className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition-colors hover:bg-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" aria-hidden="true" />
                  <span>Salvar compra</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
