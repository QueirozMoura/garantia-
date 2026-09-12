/**
 * Tipos da resposta real de GET /alerts.
 *
 * O backend (Express) serializa os campos `Date` do Prisma como strings ISO,
 * por isso `createdAt`, `startDate` e `endDate` chegam como strings.
 *
 * As regras de negócio (dias restantes, garantia vencida/vencendo, janela de 30
 * dias) pertencem ao backend. O frontend apenas apresenta `type`, `title` e
 * `message` recebidos, sem recalcular nada.
 */
export type AlertType = 'WARRANTY_EXPIRING' | 'WARRANTY_EXPIRED'

/** Garantia relacionada ao alerta (subconjunto de campos exposto pelo backend). */
export interface AlertWarranty {
  id: string
  purchaseId: string
  startDate: string
  endDate: string
}

/**
 * Dados públicos da compra relacionados ao alerta. Apenas campos públicos são
 * expostos pelo backend — `userId` e `price` nunca são retornados.
 */
export interface AlertPurchase {
  id: string
  productName: string
  brand: string | null
  model: string | null
  category: string
}

/** Alerta derivado no backend a partir das garantias do usuário. */
export interface Alert {
  id: string
  type: AlertType
  title: string
  message: string
  createdAt: string
  warranty: AlertWarranty
  purchase: AlertPurchase
}

/** Envelope de GET /alerts: `{ alerts }`. */
export interface AlertsResponse {
  alerts: Alert[]
}
