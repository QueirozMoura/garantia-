/**
 * Fonte única de categorias de compra do Garantia+.
 *
 * É apenas uma lista de sugestões/padronização de UI: o backend continua
 * tratando `category` como texto livre (trim + min 1 + max 100) e NÃO valida
 * contra esta lista. Por isso compras antigas podem ter valores fora dela
 * (ex.: "electronics", "Geladeira") — esses valores devem ser preservados e
 * representados como categoria personalizada ("Outra").
 */
export const PURCHASE_CATEGORIES = [
  'Informática',
  'Eletrônicos',
  'Eletrodomésticos',
  'Móveis',
  'Vestuário',
  'Casa e decoração',
  'Esportes',
  'Automotivo',
  'Outros',
] as const

/** Valor exibido no select quando o usuário quer digitar uma categoria própria. */
export const CUSTOM_CATEGORY_OPTION = 'Outra'

/**
 * `true` quando a categoria pertence à lista padronizada. Valores fora da lista
 * (ou vazios) são considerados personalizados, para o select exibi-los sem
 * sobrescrever o valor existente.
 */
export function isStandardCategory(value: string): boolean {
  return (PURCHASE_CATEGORIES as readonly string[]).includes(value)
}
