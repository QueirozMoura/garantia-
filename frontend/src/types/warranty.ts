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

/** Envelope de GET/POST/PUT /purchases/:purchaseId/warranty: `{ warranty }`. */
export interface WarrantyResponse {
  warranty: Warranty
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
