import { z } from 'zod';

const optionalText = z
  .string()
  .trim()
  .max(255)
  .nullish()
  .transform((value) => value || null);

// Categoria opcional na confirmação de extração: segue a MESMA regra do fluxo
// manual (trim + min 1 + max 100), mas aceita ausência/null como "não aplicar".
// Ausência/null -> null (o service mantém a categoria atual da compra); string
// vazia -> erro de validação (o schema de compras também rejeita categoria vazia).
const optionalCategory = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .nullish()
  .transform((value) => value || null);

const purchaseDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Purchase date must use YYYY-MM-DD format')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, 'Purchase date must be valid')
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

export const extractionConfirmationSchema = z.strictObject({
  productName: z.string({ message: 'Product name is required' }).trim().min(1).max(255),
  brand: optionalText,
  model: optionalText,
  purchaseDate,
  price: z.number({ message: 'Price must be a number' }).finite().nonnegative(),
  store: optionalText,
  category: optionalCategory,
  warrantyMonths: z
    .number({ message: 'Warranty duration must be a number' })
    .int('Warranty duration must be an integer')
    .positive('Warranty duration must be positive')
    .nullish(),
});

export type ExtractionConfirmationInput = z.infer<typeof extractionConfirmationSchema>;
