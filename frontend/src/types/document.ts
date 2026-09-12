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

/** Envelope de GET /purchases/:purchaseId/documents: `{ documents }`. */
export interface DocumentsResponse {
  documents: Document[]
}

/** Envelope de POST /purchases/:purchaseId/documents — responde 201 `{ document }`. */
export interface DocumentResponse {
  document: Document
}
