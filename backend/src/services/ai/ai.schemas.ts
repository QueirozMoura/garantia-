import { z } from 'zod';

const nullableText = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z.string().trim().max(255).nullable().default(null),
);

const nullableDate = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'purchaseDate must use YYYY-MM-DD format')
    .nullable()
    .default(null),
);

const nullableNumber = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.number().finite().nonnegative().nullable().default(null),
);

const nullablePositiveInteger = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.number().int().positive().nullable().default(null),
);

export const extractedPurchaseDataSchema = z.object({
  productName: nullableText,
  brand: nullableText,
  model: nullableText,
  purchaseDate: nullableDate,
  price: nullableNumber,
  store: nullableText,
  invoiceNumber: nullableText,
  warrantyMonths: nullablePositiveInteger,
});

export type ExtractedPurchaseData = z.infer<typeof extractedPurchaseDataSchema>;
