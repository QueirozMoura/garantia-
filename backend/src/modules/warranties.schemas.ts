import { z } from 'zod';

const dateSchema = z.coerce.date({ message: 'Date must be valid' });

// Strict YYYY-MM-DD parser used by the update endpoint. It mirrors the UTC
// strategy already used by purchases.schemas.ts (`purchaseDate`): the calendar
// date is validated and then materialized as UTC midnight, so no local
// timezone conversion/offset can shift the stored day.
const warrantyDateSchema = z
  .string({ message: 'Date must be a valid date' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must use YYYY-MM-DD format')
  .refine((value) => {
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, 'Date must be valid')
  .transform((value) => new Date(`${value}T00:00:00.000Z`));

const warrantyFields = {
  durationMonths: z
    .number({ message: 'Duration in months must be a number' })
    .int('Duration in months must be an integer')
    .positive('Duration in months must be positive'),
  startDate: dateSchema,
  endDate: dateSchema,
};

// Creation keeps its previous contract untouched.
export const createWarrantySchema = z
  .object(warrantyFields)
  .refine((value) => value.endDate >= value.startDate, {
    path: ['endDate'],
    message: 'End date cannot be before start date',
  });

// Update accepts only the editable warranty fields (durationMonths, startDate,
// endDate), each optional. Unknown keys (id, purchaseId, createdAt, updatedAt,
// ...) are stripped by z.object, so they can never reach the update payload.
// Dates must use the strict YYYY-MM-DD format handled in UTC.
export const updateWarrantySchema = z
  .object({
    durationMonths: warrantyFields.durationMonths.optional(),
    startDate: warrantyDateSchema.optional(),
    endDate: warrantyDateSchema.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided')
  .refine(
    (value) =>
      value.startDate === undefined ||
      value.endDate === undefined ||
      value.endDate >= value.startDate,
    {
      path: ['endDate'],
      message: 'End date cannot be before start date',
    },
  );

export type CreateWarrantyInput = z.infer<typeof createWarrantySchema>;
export type UpdateWarrantyInput = z.infer<typeof updateWarrantySchema>;
