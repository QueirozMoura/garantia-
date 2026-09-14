import type { NfeImportInvoice } from '../../types/nfe-import.ts'
import type { CreatePurchaseInput } from '../../types/purchase.ts'

/**
 * Regras de validação e mensagens amigáveis do fluxo "Importar XML / NF-e".
 *
 * Espelha os limites do backend (extensão `.xml`, 5 MB). A validação aqui é só
 * para evitar um round-trip óbvio: o backend continua sendo a autoridade e
 * revalida tudo. As mensagens nunca expõem códigos técnicos ao usuário.
 */

/** Limite do backend (5 MB), coerente com o upload multer de NF-e. */
export const MAX_NFE_FILE_SIZE = 5 * 1024 * 1024

/** Extensões e MIME aceitos pelo backend para NF-e. */
export const ACCEPTED_NFE_EXTENSIONS = ['.xml']
export const ACCEPTED_NFE_MIME_TYPES = [
  'application/xml',
  'text/xml',
  'application/octet-stream',
]

/** Extensão em minúsculas, incluindo o ponto. */
function fileExtension(fileName: string): string {
  const index = fileName.lastIndexOf('.')
  return index >= 0 ? fileName.slice(index).toLowerCase() : ''
}

/**
 * Valida o arquivo XML de NF-e no frontend: apenas `.xml` e no máximo 5 MB.
 * Retorna a mensagem de erro (ou `null` se estiver ok). O backend revalida.
 */
export function validateNfeFile(candidate: File): string | null {
  if (!ACCEPTED_NFE_EXTENSIONS.includes(fileExtension(candidate.name))) {
    return 'Selecione um arquivo XML (.xml).'
  }
  if (candidate.type && !ACCEPTED_NFE_MIME_TYPES.includes(candidate.type)) {
    return 'Selecione um arquivo XML (.xml).'
  }
  if (candidate.size > MAX_NFE_FILE_SIZE) {
    return 'O arquivo deve ter no máximo 5 MB.'
  }
  if (candidate.size === 0) {
    return 'O arquivo selecionado está vazio.'
  }
  return null
}

/**
 * Mensagens amigáveis por código de erro do backend (POST /nfe/import).
 * Nenhum código técnico é exibido ao usuário final.
 */
export const NFE_ERROR_MESSAGES: Record<string, string> = {
  NFE_FILE_REQUIRED: 'Selecione um arquivo XML para importar.',
  INVALID_NFE_TYPE: 'Selecione um arquivo XML (.xml).',
  NFE_TOO_LARGE: 'O arquivo deve ter no máximo 5 MB.',
  EMPTY_NFE_FILE: 'O arquivo selecionado está vazio.',
  INVALID_NFE_CONTENT: 'Não conseguimos ler este arquivo. Verifique se é um XML válido.',
  UNSUPPORTED_NFE_DOCUMENT:
    'O arquivo XML é válido, mas não foi reconhecido como uma NF-e compatível.',
  INVALID_NFE_DATA: 'A NF-e foi lida, mas há dados obrigatórios ausentes ou inválidos.',
  INVALID_NFE_UPLOAD: 'Não foi possível enviar o arquivo. Tente novamente.',
}

/** Mensagem para falhas de autenticação (sessão expirada). */
export const NFE_AUTH_ERROR = 'Sua sessão expirou. Entre novamente para importar a NF-e.'

/** Mensagem para falha de rede (sem resposta do servidor). */
export const NFE_NETWORK_ERROR = 'Não foi possível conectar ao servidor. Tente novamente.'

/** Mensagem para erro genérico do servidor / códigos não mapeados. */
export const NFE_FALLBACK_ERROR =
  'Não foi possível importar a NF-e agora. Tente novamente.'

/**
 * Traduz um erro da importação em uma mensagem amigável, por código/status;
 * nunca expõe stack trace, código interno ou detalhes do backend. Falhas de
 * rede (status 0) e de autenticação (401) recebem mensagens próprias.
 */
export function nfeImportFriendlyMessage(
  error: {
    status?: number
    code?: string
    message?: string
  } | null,
): string {
  if (!error) return NFE_FALLBACK_ERROR
  if (error.status === 0) return NFE_NETWORK_ERROR
  if (error.status === 401) return NFE_AUTH_ERROR
  if (error.code && NFE_ERROR_MESSAGES[error.code]) return NFE_ERROR_MESSAGES[error.code]
  return NFE_FALLBACK_ERROR
}
/**
 * Categoria usada ao transformar uma NF-e em compra. O schema atual trata
 * `category` como texto livre (máx. 100), então usamos um rótulo coerente e
 * identificável em vez de inventar um enum inexistente.
 */
export const NFE_IMPORT_CATEGORY = 'Importado por NF-e'

/** Mensagem amigável para falha ao criar a compra a partir da NF-e. */
export const NFE_CREATE_ERROR = 'Não foi possível cadastrar a compra. Tente novamente.'

/**
 * Data de emissão da NF-e (ISO, com ou sem fuso) → "YYYY-MM-DD", formato exigido
 * por POST /purchases. Usa a data tal como registrada no XML, sem deslocar por
 * fuso. Retorna `null` quando não é uma data válida.
 */
export function nfeIssuedAtToPurchaseDate(issuedAt: string): string | null {
  const isoDay = /^(\d{4}-\d{2}-\d{2})/.exec(issuedAt)
  if (!isoDay) return null
  const candidate = isoDay[1]
  const parsed = new Date(`${candidate}T00:00:00.000Z`)
  if (Number.isNaN(parsed.getTime()) || !parsed.toISOString().startsWith(candidate)) {
    return null
  }
  return candidate
}

/**
 * Converte os dados de uma NF-e em UMA `CreatePurchaseInput`.
 *
 * O modelo atual de `Purchase` representa uma compra/produto individual e não
 * tem relação de itens de NF-e. Por isso criamos UMA compra:
 *   - `productName`: descrição do primeiro item (produto principal);
 *   - `price`: valor total da NF-e;
 *   - `purchaseDate`: data de emissão;
 *   - `store`: razão social do emitente;
 *   - `brand`: nome fantasia do emitente (quando existir); `model`/`serialNumber`
 *     ficam nulos (a NF-e padrão não os traz — não inventamos valores);
 *   - `category`: rótulo fixo (`NFE_IMPORT_CATEGORY`).
 *
 * Os demais itens permanecem apenas na prévia (não são persistidos) e NÃO viram
 * uma segunda Purchase. Retorna `null` quando faltam dados mínimos.
 */
export function nfeInvoiceToPurchaseInput(
  invoice: NfeImportInvoice,
): CreatePurchaseInput | null {
  const primary = invoice.items[0]
  if (!primary || !primary.description.trim()) return null

  const purchaseDate = nfeIssuedAtToPurchaseDate(invoice.issuedAt)
  if (!purchaseDate) return null

  return {
    productName: primary.description.trim(),
    brand: invoice.issuer.tradeName?.trim() || null,
    model: null,
    serialNumber: null,
    store: invoice.issuer.name.trim() || null,
    purchaseDate,
    price: invoice.total,
    category: NFE_IMPORT_CATEGORY,
  }
}
