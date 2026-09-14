/**
 * Tipos da resposta real de POST /nfe/import.
 *
 * O endpoint recebe um XML de NF-e, valida e faz o parsing, devolvendo os dados
 * estruturados da nota. Nenhuma compra/garantia é criada nesta etapa: o frontend
 * apenas apresenta o que o backend retornou, sem inventar campos.
 *
 * Campos opcionais (`accessKey`, `tradeName`, `ncm`) podem vir `null` quando o
 * XML não os traz.
 */

export interface NfeImportItem {
  code: string
  description: string
  quantity: number
  unit: string
  unitPrice: number
  totalPrice: number
  ncm: string | null
}

export interface NfeImportIssuer {
  name: string
  tradeName: string | null
  cnpj: string
}

export interface NfeImportInvoice {
  accessKey: string | null
  number: string
  series: string
  issuedAt: string
  issuer: NfeImportIssuer
  total: number
  items: NfeImportItem[]
}

/** Envelope de POST /nfe/import: `{ message, invoice }`. */
export interface NfeImportResponse {
  message: string
  invoice: NfeImportInvoice
}
