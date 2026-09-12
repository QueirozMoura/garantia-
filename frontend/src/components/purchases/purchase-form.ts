import type { CreatePurchaseInput } from '../../types/purchase.ts'

/**
 * Regras espelhadas de backend/src/modules/purchases.schemas.ts.
 * Qualquer mudança aqui deve acompanhar o schema real do backend.
 */
const PRODUCT_NAME_MAX = 255
const OPTIONAL_TEXT_MAX = 255
const CATEGORY_MAX = 100
const PRICE_MAX = 9999.99
const CENT = 0.01

export interface PurchaseFormFields {
  productName: string
  brand: string
  model: string
  serialNumber: string
  store: string
  purchaseDate: string
  price: string
  category: string
}

type FieldErrors = Partial<Record<keyof PurchaseFormFields, string>>

export const EMPTY_PURCHASE_FIELDS: PurchaseFormFields = {
  productName: '',
  brand: '',
  model: '',
  serialNumber: '',
  store: '',
  purchaseDate: '',
  price: '',
  category: '',
}

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

/**
 * Valida espelhando as regras reais do schema de compras (create/update).
 * Usada por criação e edição, evitando duplicação.
 */
export function validatePurchaseFields(fields: PurchaseFormFields): FieldErrors {
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

  return errors
}

/**
 * Monta o corpo exatamente como o backend aceita: campos obrigatórios sempre,
 * opcionais apenas quando preenchidos (vazio -> omitido, virando null no
 * backend). Nunca envia campos extras nem userId.
 */
export function toPurchasePayload(fields: PurchaseFormFields): CreatePurchaseInput {
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
  return payload
}
