import { env } from '../../config/env.js';
import { badRequest, serviceUnavailable } from '../../utils/http-error.js';
import { GeminiProvider } from './gemini.provider.js';
import {
  AIProviderInvalidResponseError,
  AIProviderNotConfiguredError,
  AIProviderRequestError,
  AIProviderUnsupportedFormatError,
  type AIProvider,
  type AiDocumentInput,
} from './ai.provider.js';
import { extractedPurchaseDataSchema, type ExtractedPurchaseData } from './ai.schemas.js';

const extractionInstruction = [
  'Extract only facts explicitly present in the document.',
  'Return null when a field cannot be identified.',
  'Never infer, guess, calculate, or invent missing information.',
  'Return only a JSON object with the requested fields.',
  'Use purchaseDate in YYYY-MM-DD format and price as a number.',
].join(' ');

const parseJsonObject = (value: unknown): unknown => {
  if (typeof value === 'object' && value !== null) return value;
  if (typeof value !== 'string') throw new AIProviderInvalidResponseError();

  try {
    return JSON.parse(value);
  } catch {
    throw new AIProviderInvalidResponseError();
  }
};

const createHttpProvider = (): AIProvider => ({
  async extractPurchaseData(document: AiDocumentInput) {
    if (!env.aiApiUrl || !env.aiApiKey) {
      throw new AIProviderNotConfiguredError();
    }

    if (!['application/pdf', 'image/jpeg', 'image/png'].includes(document.mimeType)) {
      throw new AIProviderUnsupportedFormatError(document.mimeType);
    }

    const response = await fetch(env.aiApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.aiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instruction: extractionInstruction,
        document: {
          fileName: document.fileName,
          mimeType: document.mimeType,
          contentBase64: document.content.toString('base64'),
        },
      }),
    }).catch(() => {
      throw new AIProviderRequestError();
    });

    if (!response.ok) throw new AIProviderRequestError();

    const payload = (await response.json().catch(() => {
      throw new AIProviderInvalidResponseError();
    })) as { data?: unknown };

    return parseJsonObject(payload.data ?? payload);
  },
});

const createMockProvider = (): AIProvider => ({
  async extractPurchaseData(document) {
    void document;
    return extractedPurchaseDataSchema.parse({});
  },
});

export const getAIProvider = (): AIProvider => {
  if (env.aiProvider === 'mock') return createMockProvider();
  if (env.aiProvider === 'http') return createHttpProvider();
  if (env.aiProvider === 'gemini') return new GeminiProvider();
  throw new AIProviderNotConfiguredError();
};

export const extractPurchaseData = async (
  provider: AIProvider,
  document: AiDocumentInput,
): Promise<ExtractedPurchaseData> => {
  try {
    const result = await provider.extractPurchaseData(document);
    return extractedPurchaseDataSchema.parse(parseJsonObject(result));
  } catch (error) {
    if (
      error instanceof AIProviderNotConfiguredError ||
      error instanceof AIProviderUnsupportedFormatError ||
      error instanceof AIProviderRequestError ||
      error instanceof AIProviderInvalidResponseError
    ) {
      throw error;
    }

    throw new AIProviderInvalidResponseError();
  }
};

export const publicAIError = (error: unknown) => {
  let publicError;

  if (error instanceof AIProviderNotConfiguredError) {
    publicError = serviceUnavailable('AI provider is not configured', 'AI_PROVIDER_NOT_CONFIGURED');
  } else if (error instanceof AIProviderUnsupportedFormatError) {
    publicError = badRequest(
      'This document format is not supported by the AI provider',
      'AI_FORMAT_UNSUPPORTED',
    );
  } else if (error instanceof AIProviderRequestError) {
    publicError = serviceUnavailable('AI provider request failed', 'AI_PROVIDER_REQUEST_FAILED');
  } else if (error instanceof AIProviderInvalidResponseError) {
    publicError = serviceUnavailable(
      'AI provider returned an invalid response',
      'AI_INVALID_RESPONSE',
    );
  } else {
    return null;
  }

  publicError.cause = error;
  return publicError;
};
