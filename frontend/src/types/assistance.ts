import type { WarrantySummary } from './warranty.ts'

/**
 * Tipos da resposta real de POST /purchases/:purchaseId/assistance.
 *
 * O endpoint é stateless: verifica a compra e a situação da garantia e devolve
 * o resultado, sem persistir nada e sem IA. `warrantyStatus` é calculado pelo
 * backend (fonte da verdade) e o frontend apenas o apresenta.
 */

/** Situação da garantia calculada pelo backend (nunca recalculada no frontend). */
export type AssistanceWarrantyStatus = 'ACTIVE' | 'EXPIRED' | 'UPCOMING' | 'NONE'

/**
 * Dados básicos da compra relacionados a uma solicitação de assistência. São os
 * mesmos campos públicos já expostos em outras listagens: `userId`, `price` e
 * `serialNumber` nunca são retornados.
 */
export interface AssistancePurchase {
  id: string
  productName: string
  brand: string | null
  model: string | null
  store: string | null
  purchaseDate: string
}

/**
 * Garantia embutida na resposta de assistência. É um subconjunto público de
 * `Warranty` (sem `purchaseId`/timestamps), então reutilizamos `WarrantySummary`
 * para não duplicar o contrato. `null` quando a compra não tem garantia.
 */
export type AssistanceWarranty = WarrantySummary

/** Resultado de uma solicitação de assistência (POST .../assistance). */
export interface Assistance {
  /** O problema informado, já normalizado (`trim`) pelo backend. */
  problem: string
  /** Situação da garantia avaliada pelo backend no momento da requisição. */
  warrantyStatus: AssistanceWarrantyStatus
  purchase: AssistancePurchase
  /** Garantia atual, ou `null` quando não existe garantia cadastrada. */
  warranty: AssistanceWarranty | null
}

/** Envelope de POST /purchases/:purchaseId/assistance: `{ assistance }`. */
export interface AssistanceResponse {
  assistance: Assistance
}

/**
 * Corpo aceito por POST /purchases/:purchaseId/assistance
 * (assistanceRequestSchema no backend).
 *
 * `z.strictObject` rejeita chaves desconhecidas, portanto enviamos apenas
 * `problem`. O backend aplica `trim` e valida entre 5 e 2000 caracteres.
 */
export interface AssistanceRequestInput {
  problem: string
}

/**
 * Orientação gerada pela IA para um problema de assistência
 * (POST /purchases/:purchaseId/assistance/analyze).
 *
 * O texto é exibido exatamente como o backend devolve — o frontend não resume,
 * não reescreve e não transforma `possibleCauses` em diagnóstico definitivo.
 * O `warrantyStatus` NÃO vem aqui: a situação da garantia continua sendo a do
 * endpoint de preparação, que é a fonte da verdade.
 */
export interface AssistanceAnalysis {
  summary: string
  possibleCauses: string[]
  recommendedAction: string
  safetyNote: string
  warrantyGuidance: string
  /**
   * Documentos que PODEM ser solicitados para prosseguir com a assistência.
   * Texto exibido exatamente como o backend devolve: o frontend não acrescenta,
   * resume nem transforma a recomendação em obrigação.
   */
  requiredDocuments: string[]
}

/** Envelope de POST /purchases/:purchaseId/assistance/analyze: `{ analysis }`. */
export interface AssistanceAnalysisResponse {
  analysis: AssistanceAnalysis
}
