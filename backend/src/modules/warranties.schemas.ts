import { z } from 'zod';

const dateSchema = z.coerce.date({ message: 'Date must be valid' });

const warrantyFields = {
  durationMonths: z
    .number({ message: 'Duration in months must be a number' })
    .int('Duration in months must be an integer')
    .positive('Duration in months must be positive'),
  startDate: dateSchema,
  endDate: dateSchema,
};

export const createWarrantySchema = z
  .object(warrantyFields)
  .refine((value) => value.endDate >= value.startDate, {
    path: ['endDate'],
    message: 'End date cannot be before start date',
  });

export const updateWarrantySchema = z
  .object(warrantyFields)
  .partial()
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
