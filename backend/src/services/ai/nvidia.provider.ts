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

// Hosted NVIDIA API (OpenAI-compatible chat completions). The base URL is fixed
// here on purpose: this first step only wires up invoice extraction.
const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

// Vision-language model used for document/invoice intelligence. It accepts
// images (data URI) and text, not PDFs.
const MODEL = 'nvidia/nemotron-nano-12b-v2-vl';

// Only the image formats the chosen model can consume. PDFs are intentionally
// rejected for now (no PDF -> image conversion in this step).
const SUPPORTED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg']);

const extractionPrompt = `Analyze this invoice or purchase document image and return only one JSON object with exactly these fields:
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

// Minimal shape of the OpenAI-compatible response we care about. Only the first
// choice's message content is read; nothing else from the payload is exposed.
interface ChatCompletionChoice {
  message?: { content?: unknown };
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[];
}

/**
 * NVIDIA hosted API provider (vision-language). This step implements invoice
 * extraction from PNG/JPEG images only; PDF conversion and the assistance flows
 * are out of scope and are surfaced as unsupported without contacting NVIDIA.
 *
 * Reuses the shared AI contract errors so the public API keeps a stable,
 * provider-agnostic error surface (never leaking NVIDIA details or the API key).
 */
export class NvidiaProvider implements AIProvider {
  private readonly apiKey: string;

  constructor(apiKey = env.nvidiaApiKey) {
    if (!apiKey) throw new AIProviderNotConfiguredError();
    this.apiKey = apiKey;
  }

  async extractPurchaseData(document: AiDocumentInput): Promise<unknown> {
    if (!SUPPORTED_IMAGE_MIME_TYPES.has(document.mimeType)) {
      throw new AIProviderUnsupportedFormatError(document.mimeType);
    }

    const dataUri = `data:${document.mimeType};base64,${document.content.toString('base64')}`;

    let response: Response;
    try {
      response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: extractionPrompt },
                { type: 'image_url', image_url: { url: dataUri } },
              ],
            },
          ],
        }),
      });
    } catch {
      // Network failures never expose the underlying error/credentials.
      throw new AIProviderRequestError();
    }

    if (!response.ok) throw new AIProviderRequestError();

    const payload = (await response.json().catch(() => {
      throw new AIProviderInvalidResponseError();
    })) as ChatCompletionResponse;

    const content = payload.choices?.[0]?.message?.content;

    return parseJsonObject(content);
  }

  async analyzeAssistance(_input: AiAssistanceInput): Promise<unknown> {
    void _input;
    // Not implemented in this step. Marked as unsupported (existing contract
    // error) without contacting NVIDIA.
    throw new AIProviderUnsupportedFormatError('assistance');
  }

  async generateAssistanceMessage(_input: AiAssistanceInput): Promise<unknown> {
    void _input;
    // Not implemented in this step. Marked as unsupported (existing contract
    // error) without contacting NVIDIA.
    throw new AIProviderUnsupportedFormatError('assistance-message');
  }
}

/**
 * Parses the model's message content into a JSON object. The model is asked to
 * return raw JSON, but a stringified object is also accepted; anything else is
 * treated as an invalid provider response.
 */
const parseJsonObject = (value: unknown): unknown => {
  if (typeof value === 'object' && value !== null) return value;
  if (typeof value !== 'string') throw new AIProviderInvalidResponseError();

  try {
    return JSON.parse(value);
  } catch {
    throw new AIProviderInvalidResponseError();
  }
};
