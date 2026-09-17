import type { PurchaseFormFields } from '../components/purchases/purchase-form.ts'

/**
 * Rascunho local de uma compra iniciada por um visitante (modo guest).
 *
 * Contém APENAS os campos textuais do formulário de compra — nunca arquivos,
 * blobs, base64, tokens, cookies ou qualquer dado de autenticação. É a fonte
 * única do rascunho; `location.state` carrega somente a intenção de retomada.
 */
export interface PurchaseDraft {
  /** Versão do formato. Um draft com versão desconhecida é descartado. */
  version: 1
  /** Contexto do rascunho. Hoje só existe o de compra. */
  type: 'purchase'
  /** ISO da criação do rascunho. */
  createdAt: string
  /** ISO da última atualização (base da expiração). */
  updatedAt: string
  /** Campos exatamente como o formulário de compra os utiliza. */
  data: PurchaseFormFields
  /**
   * Sinaliza que o visitante havia selecionado um arquivo de nota fiscal
   * ANTES de virar visitante->login. É um booleano puro: NUNCA guarda o File,
   * conteúdo, base64, Blob, nome ou qualquer referência ao arquivo (o arquivo
   * vive só em memória). Serve para avisar, após a restauração, que o arquivo
   * precisa ser selecionado novamente.
   */
  hadDocumentSelection?: boolean
}

/** Versão atual suportada do rascunho. */
export const GUEST_PURCHASE_DRAFT_VERSION = 1

/**
 * Chave versionada e específica do rascunho de compra guest. Deliberadamente
 * NÃO genérica e diferente da chave do access token.
 */
export const GUEST_PURCHASE_DRAFT_KEY = 'garantia_guest_purchase_draft'

/** Rascunho mais antigo que isto (por `updatedAt`) é considerado expirado. */
export const GUEST_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 dias

/**
 * Acesso tolerante ao localStorage: em SSR ou quando o navegador bloqueia o
 * armazenamento (modo privado), retorna `null` em vez de lançar.
 */
function getStorage(): Storage | null {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null
    return window.localStorage
  } catch {
    return null
  }
}

/** Verifica que os campos recebidos formam um `PurchaseFormFields` completo. */
function isPurchaseFormFields(value: unknown): value is PurchaseFormFields {
  if (!value || typeof value !== 'object') return false
  const fields = value as Record<string, unknown>
  return (
    typeof fields.productName === 'string' &&
    typeof fields.brand === 'string' &&
    typeof fields.model === 'string' &&
    typeof fields.serialNumber === 'string' &&
    typeof fields.store === 'string' &&
    typeof fields.purchaseDate === 'string' &&
    typeof fields.price === 'string' &&
    typeof fields.category === 'string'
  )
}

/** Valida a forma completa do rascunho lido do armazenamento. */
function isPurchaseDraft(value: unknown): value is PurchaseDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as Record<string, unknown>
  return (
    draft.version === GUEST_PURCHASE_DRAFT_VERSION &&
    draft.type === 'purchase' &&
    typeof draft.createdAt === 'string' &&
    typeof draft.updatedAt === 'string' &&
    isPurchaseFormFields(draft.data) &&
    // Opcional: quando presente, precisa ser booleano (nunca conteúdo).
    (draft.hadDocumentSelection === undefined ||
      typeof draft.hadDocumentSelection === 'boolean')
  )
}

/** Remove o rascunho do armazenamento sem lançar. */
function removeStored(): void {
  const storage = getStorage()
  if (!storage) return
  try {
    storage.removeItem(GUEST_PURCHASE_DRAFT_KEY)
  } catch {
    // Falha ao remover não deve quebrar a aplicação.
  }
}

/** `true` quando o `updatedAt` está dentro período de validade. */
function isFresh(draft: PurchaseDraft, now: number): boolean {
  const updated = Date.parse(draft.updatedAt)
  if (Number.isNaN(updated)) return false
  return now - updated <= GUEST_DRAFT_TTL_MS
}

/**
 * Persiste o rascunho de compra. Preserva o `createdAt` de um rascunho
 * existente e sempre renova o `updatedAt`.
 */
export function saveGuestPurchaseDraft(
  fields: PurchaseFormFields,
  now: number = Date.now(),
  hadDocumentSelection = false,
): PurchaseDraft {
  const existing = getGuestPurchaseDraft(now)
  const timestamp = new Date(now).toISOString()
  const draft: PurchaseDraft = {
    version: GUEST_PURCHASE_DRAFT_VERSION,
    type: 'purchase',
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
    data: fields,
    // Só persiste o sinalizador quando verdadeiro — nunca conteúdo de arquivo.
    ...(hadDocumentSelection ? { hadDocumentSelection: true } : {}),
  }

  const storage = getStorage()
  if (storage) {
    try {
      storage.setItem(GUEST_PURCHASE_DRAFT_KEY, JSON.stringify(draft))
    } catch {
      // Cota cheia / armazenamento indisponível: segue sem persistir.
    }
  }
  return draft
}

/**
 * Lê o rascunho de compra. Retorna `null` e limpa o valor inválido quando o
 * JSON está corrompido, a forma é inválida, a versão é desconhecida ou o
 * rascunho expirou.
 */
export function getGuestPurchaseDraft(now: number = Date.now()): PurchaseDraft | null {
  const storage = getStorage()
  if (!storage) return null

  let raw: string | null
  try {
    raw = storage.getItem(GUEST_PURCHASE_DRAFT_KEY)
  } catch {
    return null
  }
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // JSON inválido: descarta o lixo.
    removeStored()
    return null
  }

  if (!isPurchaseDraft(parsed)) {
    // Forma/versão desconhecida: descarta.
    removeStored()
    return null
  }

  if (!isFresh(parsed, now)) {
    // Expirado: descarta e trata como inexistente.
    removeStored()
    return null
  }

  return parsed
}

/** Limpa o rascunho de compra. Não lança se o armazenamento estiver indisponível. */
export function clearGuestPurchaseDraft(): void {
  removeStored()
}

/** `true` quando existe um rascunho de compra válido (não expirado). */
export function hasGuestPurchaseDraft(now: number = Date.now()): boolean {
  return getGuestPurchaseDraft(now) !== null
}
