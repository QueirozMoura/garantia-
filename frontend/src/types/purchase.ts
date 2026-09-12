/**
 * Tipos da resposta real de GET /purchases.
 *
 * O backend serializa o Decimal `price` com `toFixed(2)`, portanto chega como
 * string no formato "1234.56". Datas (`purchaseDate`, `createdAt`, `updatedAt`)
 * são serializadas pelo Express como strings ISO.
 */
export interface Purchase {
  id: string
  productName: string
  brand: string | null
  model: string | null
  serialNumber: string | null
  store: string | null
  purchaseDate: string
  price: string // Decimal serializado: "0.00"
  category: string
  createdAt: string
  updatedAt: string
}

/** Envelope de GET /purchases: `{ purchases: [...] }`. */
export interface PurchasesResponse {
  purchases: Purchase[]
}
