import { GoogleGenAI } from '@google/genai';

import { env } from '../../config/env.js';
import {
  AIProviderInvalidResponseError,
  AIProviderNotConfiguredError,
  AIProviderRequestError,
  AIProviderUnsupportedFormatError,
  type AIProvider,
  type AiDocumentInput,
} from './ai.provider.js';

const MODEL = 'gemini-3.5-flash';

const extractionPrompt = `Analyze this invoice or purchase document and return only one JSON object with exactly these fields:
productName, brand, model, purchaseDate, price, store, invoiceNumber, warrantyMonths.

Rules:
- Extract only information explicitly present in the document.
- Never invent, guess, estimate, infer, or calculate missing information.
- Return null when a value is absent or cannot be identified with confidence.
- Do not confuse an invoice number with a serial number.
- Do not confuse a unit price with the total purchase price; use the total purchase price when it is explicitly present.
- Use purchaseDate in YYYY-MM-DD format.
- price must be a number, without currency symbols.
- warrantyMonths must be an integer when present.
- Return only the JSON object, without Markdown fences or any additional text.`;

const supportedMimeTypes = new Set(['application/pdf', 'image/jpeg', 'image/png']);

export class GeminiProvider implements AIProvider {
  private readonly client: GoogleGenAI;

  constructor(apiKey = env.geminiApiKey) {
    if (!apiKey) throw new AIProviderNotConfiguredError();
    this.client = new GoogleGenAI({ apiKey });
  }

  async extractPurchaseData(document: AiDocumentInput): Promise<unknown> {
    if (!supportedMimeTypes.has(document.mimeType)) {
      throw new AIProviderUnsupportedFormatError(document.mimeType);
    }

    try {
      const response = await this.client.models.generateContent({
        model: MODEL,
        contents: [
          {
            text: extractionPrompt,
          },
          {
            inlineData: {
              mimeType: document.mimeType,
              data: document.content.toString('base64'),
            },
          },
        ],
        config: {
          responseMimeType: 'application/json',
          temperature: 0,
        },
      });

      if (!response.text) throw new AIProviderInvalidResponseError();

      try {
        return JSON.parse(response.text);
      } catch {
        throw new AIProviderInvalidResponseError();
      }
    } catch (error) {
      if (error instanceof AIProviderInvalidResponseError) throw error;

      const requestError = new AIProviderRequestError();
      requestError.cause = error;
      throw requestError;
    }
  }
}
