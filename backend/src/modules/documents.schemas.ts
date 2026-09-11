import { z } from 'zod';

export const documentTypeSchema = z.enum(['INVOICE', 'RECEIPT', 'WARRANTY', 'OTHER']);

export const documentMetadataSchema = z.object({
  name: z.string({ message: 'Document name is required' }).trim().min(1).max(255),
  type: documentTypeSchema.default('OTHER'),
});

export type DocumentMetadataInput = z.infer<typeof documentMetadataSchema>;
