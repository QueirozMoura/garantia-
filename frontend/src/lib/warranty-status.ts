import type { Warranty } from '../types/warranty.ts'

/**
 * Status de exibição de uma garantia. É calculado apenas no frontend, para
 * apresentação — os dados vindos da API nunca são alterados.
 */
export type WarrantyStatus = 'active' | 'expiring' | 'expired' | 'upcoming'

/** Uma garantia é considerada "vencendo em breve" até este limite. */
export const EXPIRING_WINDOW_DAYS = 30

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * "Hoje" ancorado na meia-noite UTC, seguindo o mesmo padrão do projeto
 * (as datas do backend chegam como ISO em meia-noite UTC). Evita drift de fuso.
 */
function startOfTodayUtc(now: Date = new Date()): number {
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
}

/** Diferença em dias inteiros entre hoje (UTC) e a data informada. */
export function daysUntil(dateInput: string, now: Date = new Date()): number {
  const target = new Date(dateInput).getTime()
  if (Number.isNaN(target)) return 0
  return Math.round((target - startOfTodayUtc(now)) / MS_PER_DAY)
}

export interface WarrantyStatusInfo {
  status: WarrantyStatus
  /** Dias restantes (>= 0) apenas quando fizer sentido exibir. */
  daysRemaining: number
}

/**
 * Determina o status de uma garantia a partir de startDate/endDate.
 *
 * - "upcoming": ainda não começou (startDate > hoje) — nunca é tratada como ativa.
 * - "expired": endDate < hoje.
 * - "expiring": ativa e vence em até 30 dias (inclui "vence hoje").
 * - "active": ativa e com mais de 30 dias restantes.
 *
 * Função única e centralizada, usada tanto pelos indicadores quanto pelos cards.
 */
export function getWarrantyStatus(
  warranty: Pick<Warranty, 'startDate' | 'endDate'>,
  now: Date = new Date(),
): WarrantyStatusInfo {
  const today = startOfTodayUtc(now)
  const start = new Date(warranty.startDate).getTime()
  const end = new Date(warranty.endDate).getTime()

  if (end < today) {
    return { status: 'expired', daysRemaining: 0 }
  }

  if (start > today) {
    return { status: 'upcoming', daysRemaining: daysUntil(warranty.startDate, now) }
  }

  const daysRemaining = Math.max(0, daysUntil(warranty.endDate, now))

  if (daysRemaining <= EXPIRING_WINDOW_DAYS) {
    return { status: 'expiring', daysRemaining }
  }

  return { status: 'active', daysRemaining }
}

/**
 * Status exibido na LISTAGEM de compras, onde a garantia pode simplesmente não
 * existir (`null`). Estende o status de garantia com o estado "Sem garantia",
 * em vez de criar uma segunda regra de negócio paralela.
 */
export type PurchaseWarrantyStatus = WarrantyStatus | 'none'

/** Campos mínimos para derivar o status — serve a `Warranty` e a `WarrantySummary`. */
type WarrantyDates = Pick<Warranty, 'startDate' | 'endDate'>

/**
 * Status da garantia de uma compra a partir do `warranty` embutido no
 * GET /purchases. Quando `warranty` é `null`, devolve "none" sem nenhuma
 * requisição adicional.
 *
 * Toda a regra de datas vem de `getWarrantyStatus`, centralizada neste módulo.
 */
export function getPurchaseWarrantyStatus(
  warranty: WarrantyDates | null | undefined,
  now: Date = new Date(),
): { status: PurchaseWarrantyStatus; daysRemaining: number } {
  if (!warranty) {
    return { status: 'none', daysRemaining: 0 }
  }
  return getWarrantyStatus(warranty, now)
}
