/**
 * Tipos da resposta real dos endpoints de garantia.
 *
 * O backend (Express) serializa os campos `Date` do Prisma como strings ISO,
 * por isso `startDate` e `endDate` chegam como "2026-01-01T00:00:00.000Z".
 * `durationMonths` é um número inteiro positivo.
 */
export interface Warranty {
  id: string
  purchaseId: string
  durationMonths: number
  startDate: string
  endDate: string
  createdAt: string
  updatedAt: string
}

/**
 * Resumo da garantia embutido na listagem de compras (GET /purchases).
 *
 * É um subconjunto público de `Warranty` — sem `purchaseId`/timestamps — usado
 * para derivar o status na própria lista, evitando uma chamada por compra.
 */
export type WarrantySummary = Pick<
  Warranty,
  'id' | 'durationMonths' | 'startDate' | 'endDate'
>

/** Envelope de GET/POST/PUT /purchases/:purchaseId/warranty: `{ warranty }`. */
export interface WarrantyResponse {
  warranty: Warranty
}

/**
 * Dados básicos da compra relacionados a uma garantia, retornados pela
 * listagem geral (GET /warranties). Apenas campos públicos são expostos.
 */
export interface WarrantyPurchase {
  id: string
  productName: string
  brand: string | null
  model: string | null
  purchaseDate: string
  category: string
}

/** Garantia acompanhada da compra relacionada (GET /warranties). */
export interface WarrantyWithPurchase extends Warranty {
  purchase: WarrantyPurchase
}

/** Envelope de GET /warranties: `{ warranties }`. */
export interface WarrantiesResponse {
  warranties: WarrantyWithPurchase[]
}

/**
 * Corpo aceito por POST /purchases/:purchaseId/warranty (createWarrantySchema).
 *
 * As datas devem ser enviadas como strings "YYYY-MM-DD" — o backend usa
 * `z.coerce.date()`, portanto strings nesse formato são interpretadas como
 * meia-noite UTC, sem conversão de fuso no cliente.
 */
export interface CreateWarrantyInput {
  durationMonths: number
  startDate: string
  endDate: string
}

/**
 * Corpo aceito por PUT /purchases/:purchaseId/warranty (updateWarrantySchema).
 *
 * Todos os campos são opcionais, mas pelo menos um deve ser informado. O envio
 * usa sempre a forma completa (`durationMonths`/`startDate`/`endDate`), pois a
 * edição parte de uma garantia existente e manda o estado final do formulário.
 * As datas vão como "YYYY-MM-DD" (o backend materializa em meia-noite UTC).
 */
export type UpdateWarrantyInput = Partial<CreateWarrantyInput>
