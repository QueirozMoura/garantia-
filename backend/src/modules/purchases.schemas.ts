import { z } from 'zod';

const optionalText = z
  .string()
  .trim()
  .max(255)
  .nullish()
  .transform((value) => value || null);

// Parses a YYYY-MM-DD string into a UTC midnight Date, matching the date
// handling used by the extraction confirmation module to avoid timezone drift.
const purchaseDate = z
  .string({ message: 'Purchase date must be a valid date' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Purchase date must use YYYY-MM-DD format')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, 'Purchase date must be valid')
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const purchaseFields = {
  productName: z.string({ message: 'Product name is required' }).trim().min(1).max(255),
  brand: optionalText,
  model: optionalText,
  serialNumber: optionalText,
  store: optionalText,
  purchaseDate,
  price: z.coerce
    .number({ message: 'Price must be a number' })
    .finite()
    .min(0)
    .max(9999.99)
    .refine((value) => Number.isInteger(value * 100), 'Price can have at most 2 decimal places'),
  category: z.string({ message: 'Category is required' }).trim().min(1).max(100),
};

// strictObject rejects unknown keys (id, userId, createdAt, updatedAt, ...),
// preventing mass assignment of internal control fields.
export const createPurchaseSchema = z.strictObject(purchaseFields);

// Route param validation: only canonical UUIDs may reach the service/Prisma layer.
// Keeps invalid ids (e.g. "not-a-uuid") from being interpreted as a UUID by the
// database driver, which would otherwise surface as an internal error.
export const purchaseIdSchema = z.string().uuid();

export const updatePurchaseSchema = z
  .strictObject(purchaseFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided');

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;
