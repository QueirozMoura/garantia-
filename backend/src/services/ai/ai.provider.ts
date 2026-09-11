import type { ExtractedPurchaseData } from './ai.schemas.js';

export type AiDocumentMimeType = 'application/pdf' | 'image/jpeg' | 'image/png';

export interface AiDocumentInput {
  content: Buffer;
  mimeType: AiDocumentMimeType;
  fileName: string;
}

export interface AIProvider {
  extractPurchaseData(document: AiDocumentInput): Promise<unknown>;
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
