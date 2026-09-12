import type { WarrantySummary } from './warranty.ts'

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
  /**
   * Garantia embutida pelo GET /purchases — `null` quando a compra não possui
   * garantia. O status é derivado no frontend: não há chamada por item.
   *
   * Presente apenas na LISTAGEM: `GET /purchases/:id`, `POST` e `PUT` mantêm o
   * contrato anterior e não devolvem este campo. Por isso os consumidores que
   * usam essas respostas tratam `warranty` como possivelmente ausente.
   */
  warranty: WarrantySummary | null
  createdAt: string
  updatedAt: string
}

/** Envelope de GET /purchases: `{ purchases: [...] }`. */
export interface PurchasesResponse {
  purchases: Purchase[]
}

/**
 * Corpo aceito por POST /purchases (createPurchaseSchema no backend).
 *
 * `price` é enviado como número — o backend usa `z.coerce.number()` e rejeita
 * o objeto se houver chaves desconhecidas (`z.strictObject`).
 * `purchaseDate` deve ser a string "YYYY-MM-DD".
 * `brand`, `model`, `serialNumber` e `store` são opcionais.
 */
export interface CreatePurchaseInput {
  productName: string
  brand?: string | null
  model?: string | null
  serialNumber?: string | null
  store?: string | null
  purchaseDate: string
  price: number
  category: string
}

/**
 * Corpo aceito por PUT /purchases/:id (updatePurchaseSchema no backend).
 *
 * Mesmas regras do create (`z.strictObject`), com todos os campos opcionais —
 * o backend aceita atualização parcial. Usamos a mesma forma do create na
 * edição (envia todos os campos preenchidos).
 */
export type UpdatePurchaseInput = CreatePurchaseInput
/** Resposta de POST /purchases: 201 `{ purchase }`. */
export interface CreatePurchaseResponse {
  purchase: Purchase
}

/** Resposta de PUT /purchases/:id: 200 `{ purchase }`. */
export interface UpdatePurchaseResponse {
  purchase: Purchase
}
