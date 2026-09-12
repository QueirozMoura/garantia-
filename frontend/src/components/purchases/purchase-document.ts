/**
 * Regras de validação e formatação de arquivos de documento, espelhadas das
 * regras do backend (upload multer). Compartilhado entre o formulário de
 * documentos (PurchaseDocumentsSection) e o fluxo "Adicionar compra + nota
 * fiscal" (AddPurchase), para não duplicar a mesma lógica.
 */

/** Limite do backend (10 MB). Validação básica só para evitar round-trip. */
export const MAX_FILE_SIZE = 10 * 1024 * 1024

/** Extensões e MIME aceitos pelo backend. */
export const ACCEPTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png']
export const ACCEPTED_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

/**
 * Formata bytes em KB/MB com no máximo uma casa decimal.
 * Abaixo de 1 KB, mostra em bytes para não exibir "0 KB".
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes < 1024) return `${bytes} B`

  const kilobytes = bytes / 1024
  if (kilobytes < 1024) return `${kilobytes.toFixed(1).replace('.0', '')} KB`

  const megabytes = kilobytes / 1024
  return `${megabytes.toFixed(1).replace('.0', '')} MB`
}

/** Extensão em minúsculas, incluindo o ponto. */
export function fileExtension(fileName: string): string {
  const index = fileName.lastIndexOf('.')
  return index >= 0 ? fileName.slice(index).toLowerCase() : ''
}

/**
 * Valida o arquivo de nota fiscal: apenas PDF/JPEG/PNG e no máximo 10 MB.
 * Extensão e MIME são checados; o backend continua sendo a fonte de verdade.
 */
export function validateDocumentFile(candidate: File): string | null {
  if (!ACCEPTED_EXTENSIONS.includes(fileExtension(candidate.name))) {
    return 'Este arquivo não é suportado.'
  }
  if (candidate.type && !ACCEPTED_MIME_TYPES.includes(candidate.type)) {
    return 'Este arquivo não é suportado.'
  }
  if (candidate.size > MAX_FILE_SIZE) {
    return 'O arquivo deve ter no máximo 10 MB.'
  }
  return null
}

/**
 * Deriva o nome do documento a partir do nome original do arquivo, sem inventar
 * dados: "nota-fiscal.pdf" → "nota-fiscal". Se o nome ficar vazio, usa "Nota
 * fiscal" como rótulo neutro.
 */
export function documentNameFromFileName(fileName: string): string {
  const index = fileName.lastIndexOf('.')
  const base = index > 0 ? fileName.slice(0, index) : fileName
  const trimmed = base.trim()
  return trimmed || 'Nota fiscal'
}

/** Placeholder mostrado quando a IA não identificou o campo (valor null). */
export const NOT_IDENTIFIED = 'Não identificado'

/** Mensagens amigáveis por código de erro da análise por IA (sem detalhes internos). */
export const EXTRACT_ERROR_MESSAGES: Record<string, string> = {
  AI_PROVIDER_NOT_CONFIGURED: 'Não foi possível analisar a nota fiscal agora.',
  AI_PROVIDER_REQUEST_FAILED:
    'A análise da nota fiscal falhou. Você pode tentar novamente.',
  AI_INVALID_RESPONSE: 'Não conseguimos interpretar os dados da nota fiscal.',
}

/** Mensagem amigável para falha de rede (sem resposta do servidor). */
export const EXTRACT_NETWORK_ERROR =
  'Não foi possível conectar ao serviço de análise. Tente novamente.'

/** Mensagem padrão para falhas que não têm um código específico mapeado. */
export const EXTRACT_FALLBACK_ERROR =
  'Não foi possível analisar a nota fiscal. Tente novamente.'

/**
 * Traduz um erro da extração em uma mensagem amigável, por código de erro do
 * backend; nunca expõe API key, stack trace ou detalhes internos. Falhas de
 * rede (status 0) recebem uma mensagem própria.
 */
export function extractFriendlyMessage(
  error: {
    status?: number
    code?: string
    message?: string
  } | null,
): string {
  if (!error) return EXTRACT_FALLBACK_ERROR
  if (error.status === 0) return EXTRACT_NETWORK_ERROR
  // Código específico, quando o backend o expõe.
  if (error.code && EXTRACT_ERROR_MESSAGES[error.code])
    return EXTRACT_ERROR_MESSAGES[error.code]
  if (error.status === 404) return 'Esta nota fiscal não está mais disponível.'
  // O backend hoje mapeia falhas de IA para 503 (algumas mascaradas como
  // INTERNAL_ERROR); tratamos por status para manter a mensagem correta.
  if (error.status === 502) return EXTRACT_ERROR_MESSAGES.AI_INVALID_RESPONSE
  if (error.status === 503) return EXTRACT_ERROR_MESSAGES.AI_PROVIDER_REQUEST_FAILED
  return EXTRACT_FALLBACK_ERROR
}
