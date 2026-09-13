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

// Structured triage guidance produced by the AI for an assistance request.
// Every field is required and non-empty: a partially empty answer is treated as
// an invalid provider response so the client never renders a broken analysis.
const guidanceText = (max: number) => z.string().trim().min(1).max(max);

export const assistanceAnalysisSchema = z.object({
  summary: guidanceText(500),
  possibleCauses: z.array(guidanceText(300)).min(1).max(3),
  recommendedAction: guidanceText(1000),
  safetyNote: guidanceText(1000),
  warrantyGuidance: guidanceText(1000),
  // General documents/proofs the user may be asked for when requesting
  // assistance. Kept as plain strings (no persistence, no dedicated system).
  // Each item must be non-empty and short; duplicates are collapsed so the
  // provider cannot pad the list with the same entry repeated.
  requiredDocuments: z
    .array(guidanceText(200))
    .min(1)
    .max(5)
    .transform((documents) => [...new Set(documents)]),
});

// Ready-to-send assistance message produced by the AI. A single free-text field
// the user can copy and send to a technical service or manufacturer. Required
// and non-empty: an empty or too-short answer is treated as an invalid provider
// response, never rendered as a broken message.
export const assistanceMessageSchema = z.object({
  message: z.string().trim().min(20).max(2000),
});

export type ExtractedPurchaseData = z.infer<typeof extractedPurchaseDataSchema>;
export type AssistanceAnalysis = z.infer<typeof assistanceAnalysisSchema>;
export type AssistanceMessage = z.infer<typeof assistanceMessageSchema>;
