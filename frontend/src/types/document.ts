import type { Purchase } from './purchase.ts'
import type { Warranty } from './warranty.ts'

/**
 * Tipos da resposta real dos endpoints de documentos.
 *
 * O backend (Express) serializa os campos `Date` do Prisma como strings ISO,
 * por isso `createdAt` e `updatedAt` chegam como "2026-09-11T00:00:00.000Z".
 * `type` é sempre um dos quatro valores aceitos pelo backend.
 */
export type DocumentType = 'INVOICE' | 'RECEIPT' | 'WARRANTY' | 'OTHER'

export interface Document {
  id: string
  purchaseId: string
  name: string
  fileName: string
  mimeType: string
  size: number
  type: DocumentType
  createdAt: string
  updatedAt: string
}

/**
 * Dados básicos da compra relacionados a um documento, retornados pela
 * listagem geral (GET /documents). Apenas campos públicos são expostos pelo
 * backend — `userId` e `price` nunca são retornados.
 */
export interface DocumentPurchase {
  id: string
  productName: string
  brand: string | null
  model: string | null
  purchaseDate: string
  category: string
}

/** Documento acompanhado da compra relacionada (GET /documents). */
export interface DocumentWithPurchase extends Document {
  purchase: DocumentPurchase
}

/**
 * Envelope de GET /purchases/:purchaseId/documents: `{ documents }`.
 * Estes documentos não trazem a compra embutida.
 */
export interface DocumentsResponse {
  documents: Document[]
}

/**
 * Envelope de GET /documents: `{ documents }`, cada documento acompanhado dos
 * dados públicos da compra relacionada.
 */
export interface DocumentsListResponse {
  documents: DocumentWithPurchase[]
}

/** Envelope de POST /purchases/:purchaseId/documents — responde 201 `{ document }`. */
export interface DocumentResponse {
  document: Document
}

/**
 * Dados extraídos de uma nota fiscal pela IA (POST /documents/:documentId/extract).
 *
 * Todos os campos podem ser `null` quando a IA não conseguiu identificar o
 * valor. `purchaseDate` chega como string "YYYY-MM-DD" (ou null); `price` e
 * `warrantyMonths` são números ou null. O frontend não deve inventar valores.
 */
export interface DocumentExtraction {
  productName: string | null
  brand: string | null
  model: string | null
  purchaseDate: string | null
  price: number | null
  store: string | null
  invoiceNumber: string | null
  warrantyMonths: number | null
}

/** Envelope de POST /documents/:documentId/extract: `{ data }`. */
export interface DocumentExtractionResponse {
  data: DocumentExtraction
}

/**
 * Resposta de PATCH /documents/:documentId/extraction: `{ purchase, warranty }`.
 *
 * `purchase` é a compra já atualizada (mesmo formato de GET /purchases);
 * `warranty` é a garantia criada/atualizada quando a extração trouxe
 * `warrantyMonths`, ou `null` quando nada foi aplicado. Reutiliza os tipos
 * existentes de Purchase/Warranty para não duplicar contratos.
 */
export interface DocumentExtractionConfirmationResponse {
  purchase: Purchase
  warranty: Warranty | null
}
