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
