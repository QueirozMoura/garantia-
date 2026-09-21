/**
 * Fonte canônica de categorias de compra do Garantia+ (backend).
 *
 * Espelha a lista do frontend (`frontend/src/lib/categories.ts`). É apenas a
 * fonte dos valores permitidos: por compatibilidade, o banco ainda aceita
 * texto livre, então compras antigas podem ter valores fora desta lista
 * (ex.: "electronics", "Geladeira"). Não inclui "Outra": esse rótulo é uma
 * opção de interface e nunca é persistido.
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
] as const;

/** Categoria canônica do produto. */
export type PurchaseCategory = (typeof PURCHASE_CATEGORIES)[number];

/** `true` quando `value` é uma das categorias canônicas. */
export const isPurchaseCategory = (value: string): value is PurchaseCategory =>
  (PURCHASE_CATEGORIES as readonly string[]).includes(value);
