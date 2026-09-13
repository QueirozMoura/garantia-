import { ApiError } from '../../lib/api.ts'

/**
 * Helpers do formulário de assistência, isolados em arquivo próprio (mesmo
 * padrão de `warranty-form.ts`/`purchase-form.ts`). Nada aqui dispara
 * requisição: são apenas regras de validação e mapeamento de erros.
 */

/** Limites do campo "problema" — iguais aos validados pelo backend. */
export const PROBLEM_MIN_LENGTH = 5
export const PROBLEM_MAX_LENGTH = 2000

const FALLBACK_ERROR = 'Não foi possível verificar a garantia. Tente novamente.'

/**
 * Valida o texto digitado antes de qualquer POST. Normaliza com `trim` para que
 * espaços nas extremidades (ou um texto só com espaços) não passem.
 * Retorna a mensagem de erro ou `null` quando o valor é válido.
 */
export function validateProblem(rawValue: string): string | null {
  const value = rawValue.trim()
  if (value === '') {
    return 'Descreva o problema para solicitar assistência.'
  }
  if (value.length < PROBLEM_MIN_LENGTH) {
    return `Descreva o problema com pelo menos ${PROBLEM_MIN_LENGTH} caracteres.`
  }
  if (value.length > PROBLEM_MAX_LENGTH) {
    return `O texto deve ter no máximo ${PROBLEM_MAX_LENGTH} caracteres.`
  }
  return null
}

/**
 * Mensagens amigáveis por status HTTP do POST de assistência. 401 é tratado
 * antes (segue o fluxo de autenticação global), então não aparece aqui.
 */
export function assistanceErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400) return 'Verifique o problema informado e tente novamente.'
    if (error.status === 403) return 'Você não tem acesso a esta compra.'
    if (error.status === 404) return 'Compra não encontrada.'
  }
  // 500, erro de rede e demais casos caem na mensagem genérica amigável.
  return FALLBACK_ERROR
}
