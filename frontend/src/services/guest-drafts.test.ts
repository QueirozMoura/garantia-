// Testes do serviço de rascunho de compra de visitante.
//
// Cobrem persistência, leitura, limpeza e TODOS os casos de falha tolerados:
// JSON inválido, forma inválida, versão desconhecida, dados incompletos,
// expiração e localStorage indisponível/quebrado.
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import {
  clearGuestPurchaseDraft,
  getGuestPurchaseDraft,
  GUEST_DRAFT_TTL_MS,
  GUEST_PURCHASE_DRAFT_KEY,
  GUEST_PURCHASE_DRAFT_VERSION,
  hasGuestPurchaseDraft,
  saveGuestPurchaseDraft,
} from './guest-drafts.ts'
import type { PurchaseFormFields } from '../components/purchases/purchase-form.ts'

const FIELDS: PurchaseFormFields = {
  productName: 'Notebook Dell XPS 15',
  brand: 'Dell',
  model: 'XPS 15 9530',
  serialNumber: 'SN-12345',
  store: 'Magazine Luiza',
  purchaseDate: '2026-01-15',
  price: '8749.90',
  category: 'Informática',
}

describe('guest-drafts', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('salva e recupera o rascunho com os campos do formulário', () => {
    const saved = saveGuestPurchaseDraft(FIELDS)

    expect(saved.version).toBe(GUEST_PURCHASE_DRAFT_VERSION)
    expect(saved.type).toBe('purchase')
    expect(saved.data).toEqual(FIELDS)

    const restored = getGuestPurchaseDraft()
    expect(restored?.data).toEqual(FIELDS)
  })

  it('persiste na chave versionada dedicada', () => {
    saveGuestPurchaseDraft(FIELDS)

    expect(localStorage.getItem(GUEST_PURCHASE_DRAFT_KEY)).not.toBeNull()
  })

  it('preserva o createdAt ao atualizar um rascunho existente', () => {
    const now = Date.now()
    const first = saveGuestPurchaseDraft(FIELDS, now - 1000)
    const second = saveGuestPurchaseDraft(
      { ...FIELDS, productName: 'Outro produto' },
      now,
    )

    expect(second.createdAt).toBe(first.createdAt)
    expect(second.updatedAt).not.toBe(first.updatedAt)
    expect(getGuestPurchaseDraft()?.data.productName).toBe('Outro produto')
  })

  it('limpa o rascunho', () => {
    saveGuestPurchaseDraft(FIELDS)
    expect(hasGuestPurchaseDraft()).toBe(true)

    clearGuestPurchaseDraft()

    expect(getGuestPurchaseDraft()).toBeNull()
    expect(hasGuestPurchaseDraft()).toBe(false)
  })

  it('retorna null e limpa quando o JSON é inválido', () => {
    localStorage.setItem(GUEST_PURCHASE_DRAFT_KEY, '{not-json')

    expect(getGuestPurchaseDraft()).toBeNull()
    expect(localStorage.getItem(GUEST_PURCHASE_DRAFT_KEY)).toBeNull()
  })

  it('retorna null e limpa quando a versão é desconhecida', () => {
    localStorage.setItem(
      GUEST_PURCHASE_DRAFT_KEY,
      JSON.stringify({
        version: 999,
        type: 'purchase',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data: FIELDS,
      }),
    )

    expect(getGuestPurchaseDraft()).toBeNull()
    expect(localStorage.getItem(GUEST_PURCHASE_DRAFT_KEY)).toBeNull()
  })

  it('retorna null e limpa quando os dados estão incompletos', () => {
    localStorage.setItem(
      GUEST_PURCHASE_DRAFT_KEY,
      JSON.stringify({
        version: GUEST_PURCHASE_DRAFT_VERSION,
        type: 'purchase',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data: { productName: 'Só o nome' },
      }),
    )

    expect(getGuestPurchaseDraft()).toBeNull()
    expect(localStorage.getItem(GUEST_PURCHASE_DRAFT_KEY)).toBeNull()
  })

  it('retorna null e limpa quando o draft expirou (mais de 7 dias)', () => {
    const now = Date.now()
    saveGuestPurchaseDraft(FIELDS, now - GUEST_DRAFT_TTL_MS - 1000)

    expect(getGuestPurchaseDraft(now)).toBeNull()
    expect(localStorage.getItem(GUEST_PURCHASE_DRAFT_KEY)).toBeNull()
  })

  it('mantém o draft dentro da janela de validade', () => {
    const now = Date.now()
    saveGuestPurchaseDraft(FIELDS, now - GUEST_DRAFT_TTL_MS + 1000)

    expect(getGuestPurchaseDraft(now)?.data).toEqual(FIELDS)
  })

  it('não quebra quando o localStorage está indisponível', () => {
    vi.stubGlobal('localStorage', undefined)

    // Não lança em nenhuma operação.
    expect(() => saveGuestPurchaseDraft(FIELDS)).not.toThrow()
    expect(getGuestPurchaseDraft()).toBeNull()
    expect(hasGuestPurchaseDraft()).toBe(false)
    expect(() => clearGuestPurchaseDraft()).not.toThrow()
  })

  it('não quebra quando o setItem lança (cota cheia)', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })

    expect(() => saveGuestPurchaseDraft(FIELDS)).not.toThrow()
    setItem.mockRestore()
  })

  // --- hadDocumentSelection (Etapa 5): só um booleano, nunca conteúdo ------
  it('omite hadDocumentSelection quando não havia arquivo selecionado', () => {
    const saved = saveGuestPurchaseDraft(FIELDS)

    expect(saved.hadDocumentSelection).toBeUndefined()
    expect(localStorage.getItem(GUEST_PURCHASE_DRAFT_KEY)).not.toContain(
      'hadDocumentSelection',
    )
  })

  it('registra hadDocumentSelection: true sem guardar o arquivo', () => {
    const saved = saveGuestPurchaseDraft(FIELDS, Date.now(), true)

    expect(saved.hadDocumentSelection).toBe(true)
    const raw = localStorage.getItem(GUEST_PURCHASE_DRAFT_KEY) ?? ''
    expect(raw).toContain('"hadDocumentSelection":true')
    // Nunca conteúdo/nome/base64/Blob do arquivo.
    expect(raw).not.toMatch(/base64|blob:|%PDF|iVBOR|data:|fileName|\.pdf/i)
  })

  it('lê um rascunho com hadDocumentSelection: true', () => {
    saveGuestPurchaseDraft(FIELDS, Date.now(), true)

    expect(getGuestPurchaseDraft()?.hadDocumentSelection).toBe(true)
  })

  it('descarta rascunho com hadDocumentSelection não booleano', () => {
    localStorage.setItem(
      GUEST_PURCHASE_DRAFT_KEY,
      JSON.stringify({
        version: GUEST_PURCHASE_DRAFT_VERSION,
        type: 'purchase',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        data: FIELDS,
        hadDocumentSelection: 'nota.pdf',
      }),
    )

    expect(getGuestPurchaseDraft()).toBeNull()
    expect(localStorage.getItem(GUEST_PURCHASE_DRAFT_KEY)).toBeNull()
  })
})
