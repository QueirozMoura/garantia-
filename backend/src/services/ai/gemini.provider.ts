import { GoogleGenAI } from '@google/genai';

import { env } from '../../config/env.js';
import {
  AIProviderInvalidResponseError,
  AIProviderNotConfiguredError,
  AIProviderRequestError,
  AIProviderUnsupportedFormatError,
  type AIProvider,
  type AiAssistanceInput,
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

const assistancePrompt = `You are a triage assistant for product warranty assistance. You receive a purchase summary, the warranty status already computed by the system, and the problem reported by the user. Return only one JSON object with exactly these fields: summary, possibleCauses, recommendedAction, safetyNote, warrantyGuidance.

Rules:
- Return only the JSON object, with no Markdown fences or any additional text.
- summary: a short, objective summary of the reported problem. Never present a diagnosis as certainty.
- possibleCauses: an array of 1 to 3 items, each written as a possibility ("pode ser", "é possível que"). Do not invent highly specific causes when there is not enough information.
- recommendedAction: the single safest next step. Prefer authorized technical assistance or the manufacturer when appropriate. Never recommend opening, disassembling or performing dangerous electrical procedures.
- safetyNote: always present. When there is no evident risk, a short reminder such as avoiding disassembling the equipment while it is under warranty is enough. Never instruct dangerous electrical procedures.
- warrantyGuidance: base it strictly on the warranty status provided by the system (ACTIVE, EXPIRED, UPCOMING or NONE). For ACTIVE, guide the user to check authorized assistance channels and purchase documents. For EXPIRED, state clearly that the registered warranty is expired and suggest technical assistance or a quote. For UPCOMING, state clearly that the warranty has not started yet. For NONE, state clearly that there is no warranty registered in the system.
- The warranty status provided by the system is the single source of truth. Do not recalculate, override or contradict it.
- Never claim a repair is definitely required, never claim the problem is covered by the warranty, and never invent warranty, store or manufacturer policies.`;

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

  async analyzeAssistance(input: AiAssistanceInput): Promise<unknown> {
    try {
      const response = await this.client.models.generateContent({
        model: MODEL,
        contents: [
          {
            text: `${assistancePrompt}\n\nInput data (JSON):\n${JSON.stringify(input)}`,
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
