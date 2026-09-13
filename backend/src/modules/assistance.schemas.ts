import { z } from 'zod';

// Assistance body: a single free-text problem description. `strictObject`
// rejects unknown keys so additional fields can never reach the service.
export const assistanceRequestSchema = z.strictObject({
  problem: z
    .string({ message: 'Problem description is required' })
    .trim()
    .min(5, 'Problem description must be at least 5 characters')
    .max(2000, 'Problem description must be at most 2000 characters'),
});

export type AssistanceRequestInput = z.infer<typeof assistanceRequestSchema>;
