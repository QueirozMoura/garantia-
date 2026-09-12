import type { DocumentType } from '../../types/document.ts'

/**
 * Rótulo em português para cada tipo de documento.
 * Valores desconhecidos recaem em "Outro" na renderização, sem alterar o valor
 * original recebido da API.
 */
export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  INVOICE: 'Nota fiscal',
  RECEIPT: 'Recibo',
  WARRANTY: 'Garantia',
  OTHER: 'Outro',
}

/** Rótulo amigável para um tipo vindo da API, com fallback para "Outro". */
export function documentTypeLabel(type: DocumentType): string {
  return DOCUMENT_TYPE_LABELS[type] ?? DOCUMENT_TYPE_LABELS.OTHER
}

/**
 * Formata bytes em KB/MB com no máximo uma casa decimal.
 * Abaixo de 1 KB, mostra em bytes para não exibir "0 KB".
 * Mesma convenção usada na seção de documentos da compra.
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB'
  if (bytes < 1024) return `${bytes} B`

  const kilobytes = bytes / 1024
  if (kilobytes < 1024) return `${kilobytes.toFixed(1).replace('.0', '')} KB`

  const megabytes = kilobytes / 1024
  return `${megabytes.toFixed(1).replace('.0', '')} MB`
}
