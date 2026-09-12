/**
 * Regras de validação do formulário de garantia (criação e edição).
 *
 * Espelham `backend/src/modules/warranties.schemas.ts` — duração inteira
 * positiva e `endDate >= startDate`. As datas continuam como strings
 * "YYYY-MM-DD" (sem conversão de fuso) e a comparação é lexicográfica, que é
 * equivalente à cronológica nesse formato.
 */

export interface WarrantyFormValues {
  /** Duração em meses, como digitada no input (string). */
  durationMonths: string
  startDate: string
  endDate: string
}

export interface WarrantyFormErrors {
  durationMonths?: string
  startDate?: string
  endDate?: string
}

/** `true` quando a string é uma data de calendário real no formato YYYY-MM-DD. */
function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

/**
 * Valida os três campos e devolve as mensagens em português. O formulário só
 * habilita o envio quando o objeto retornado está vazio.
 */
export function validateWarrantyValues(values: WarrantyFormValues): WarrantyFormErrors {
  const errors: WarrantyFormErrors = {}
  const duration = Number(values.durationMonths)

  if (!values.durationMonths) {
    errors.durationMonths = 'Informe a duração em meses.'
  } else if (!Number.isInteger(duration) || duration <= 0) {
    errors.durationMonths = 'A duração deve ser um número inteiro positivo.'
  }

  if (!values.startDate) {
    errors.startDate = 'Informe a data de início.'
  } else if (!isValidIsoDate(values.startDate)) {
    errors.startDate = 'Informe uma data de início válida.'
  }

  if (!values.endDate) {
    errors.endDate = 'Informe a data de término.'
  } else if (!isValidIsoDate(values.endDate)) {
    errors.endDate = 'Informe uma data de término válida.'
  } else if (
    !errors.startDate &&
    !errors.durationMonths &&
    values.endDate < values.startDate
  ) {
    // Mesma regra do backend (INVALID_WARRANTY_DATE_RANGE), checada aqui para
    // evitar um request que já se sabe inválido.
    errors.endDate = 'A data de término não pode ser anterior à data de início.'
  }

  return errors
}

/** Body enxuto aceito por POST/PUT: só os três campos editáveis. */
export function toWarrantyPayload(values: WarrantyFormValues): {
  durationMonths: number
  startDate: string
  endDate: string
} {
  return {
    durationMonths: Number(values.durationMonths),
    startDate: values.startDate,
    endDate: values.endDate,
  }
}

/**
 * Extrai "YYYY-MM-DD" de uma data ISO do backend sem passar pelo fuso local.
 * `new Date(...).toISOString().slice(0, 10)` bastaria aqui porque as datas de
 * garantia chegam em meia-noite UTC, mas o corte direto é imune a qualquer
 * offset e não depende do navegador interpretar a string.
 */
export function toIsoDateInput(isoDate: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(isoDate)
  return match ? match[1] : ''
}
