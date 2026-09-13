import type { ExtractedPurchaseData } from './ai.schemas.js';

export type AiDocumentMimeType = 'application/pdf' | 'image/jpeg' | 'image/png';

export interface AiDocumentInput {
  content: Buffer;
  mimeType: AiDocumentMimeType;
  fileName: string;
}

// Warranty status is always computed by the backend and passed to the AI as the
// single source of truth; the model only produces the matching textual guidance.
export type AiWarrantyStatus = 'ACTIVE' | 'EXPIRED' | 'UPCOMING' | 'NONE';

// Only the fields the model needs to reason about the problem. No ids, prices,
// serial numbers or other internal data are included.
export interface AiAssistanceInput {
  productName: string;
  brand: string | null;
  model: string | null;
  store: string | null;
  purchaseDate: string;
  warrantyStatus: AiWarrantyStatus;
  warrantyStartDate: string | null;
  warrantyEndDate: string | null;
  problem: string;
}

export interface AIProvider {
  extractPurchaseData(document: AiDocumentInput): Promise<unknown>;
  analyzeAssistance(input: AiAssistanceInput): Promise<unknown>;
}

export class AIProviderNotConfiguredError extends Error {
  constructor() {
    super('AI provider is not configured');
    this.name = 'AIProviderNotConfiguredError';
  }
}

export class AIProviderUnsupportedFormatError extends Error {
  constructor(mimeType: string) {
    super(`AI provider does not support ${mimeType}`);
    this.name = 'AIProviderUnsupportedFormatError';
  }
}

export class AIProviderRequestError extends Error {
  constructor() {
    super('AI provider request failed');
    this.name = 'AIProviderRequestError';
  }
}

export class AIProviderInvalidResponseError extends Error {
  constructor() {
    super('AI provider returned an invalid response');
    this.name = 'AIProviderInvalidResponseError';
  }
}

export type AIProviderResult = ExtractedPurchaseData;
