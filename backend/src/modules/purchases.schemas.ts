import { z } from 'zod';

const optionalText = z
  .string()
  .trim()
  .max(255)
  .nullish()
  .transform((value) => value || null);

const purchaseFields = {
  productName: z.string({ message: 'Product name is required' }).trim().min(1).max(255),
  brand: optionalText,
  model: optionalText,
  serialNumber: optionalText,
  store: optionalText,
  purchaseDate: z.coerce.date({ message: 'Purchase date must be a valid date' }),
  price: z.coerce
    .number({ message: 'Price must be a number' })
    .finite()
    .min(0)
    .max(9999.99)
    .refine((value) => Number.isInteger(value * 100), 'Price can have at most 2 decimal places'),
  category: z.string({ message: 'Category is required' }).trim().min(1).max(100),
};

export const createPurchaseSchema = z.object(purchaseFields);

export const updatePurchaseSchema = z
  .object(purchaseFields)
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided');

export type CreatePurchaseInput = z.infer<typeof createPurchaseSchema>;
export type UpdatePurchaseInput = z.infer<typeof updatePurchaseSchema>;
