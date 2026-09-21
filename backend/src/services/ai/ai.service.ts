import { env } from '../../config/env.js';
import {
  isPurchaseCategory,
  PURCHASE_CATEGORIES,
} from '../../modules/categories.js';
import { badRequest, serviceUnavailable } from '../../utils/http-error.js';
import { GeminiProvider } from './gemini.provider.js';
import { NvidiaProvider } from './nvidia.provider.js';
import {
  AIProviderInvalidResponseError,
  AIProviderNotConfiguredError,
  AIProviderRequestError,
  AIProviderUnsupportedFormatError,
  type AIProvider,
  type AiAssistanceInput,
  type AiDocumentInput,
} from './ai.provider.js';
import {
  assistanceAnalysisSchema,
  assistanceMessageSchema,
  extractedPurchaseDataSchema,
  type AssistanceAnalysis,
  type AssistanceMessage,
  type ExtractedPurchaseData,
} from './ai.schemas.js';

const extractionInstruction = [
  'Extract only facts explicitly present in the document.',
  'Return null when a field cannot be identified.',
  'Never infer, guess, calculate, or invent missing information.',
  'Return only a JSON object with the requested fields.',
  'Use purchaseDate in YYYY-MM-DD format and price as a number.',
  `For category, return exactly one of these values: ${PURCHASE_CATEGORIES.join(', ')}.`,
  'Do not create, combine, translate or invent categories, and never return a value outside the allowed list; return null when the document does not provide enough evidence to classify the product.',
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

// The model must answer only with JSON matching the analysis schema. Safety
// guardrails are stated here as well, so the http provider (not just Gemini)
// carries the same rules.
const assistanceInstruction = [
  'You are a triage assistant for product warranty assistance.',
  'Return only a JSON object matching the requested fields, with no Markdown fences or extra text.',
  'Never state a diagnosis as certainty; present causes only as possibilities.',
  'Never claim a repair is definitely required.',
  'Never claim the problem is covered by the warranty and never invent warranty rules.',
  'Never invent store or manufacturer policies.',
  'Never instruct the user to open, disassemble or perform dangerous electrical procedures.',
  'Prioritize safety and recommend professional/authorized service when appropriate.',
  'Treat the warranty status provided by the system as the single source of truth.',
  'Also return requiredDocuments: 1 to 5 short general documents or proofs the user may be asked for, each a non-empty string with no duplicates.',
  'Prefer generic purchase/warranty documents and never invent store or manufacturer document policies, nor state that a document is legally mandatory.',
].join(' ');

// The model must answer only with JSON matching the message schema. The safety
// guardrails are stated here as well, so the http provider (not just Gemini)
// carries the same rules.
const assistanceMessageInstruction = [
  'You write a single ready-to-send assistance message in Brazilian Portuguese that the user can copy and send to a technical service, a manufacturer or a support channel.',
  'Return only a JSON object with exactly one field, message, with no Markdown fences or extra text.',
  'The message must be polite, professional, natural, short and ready to copy and send.',
  'Identify the product when there is enough information (brand and/or model); never invent details that are absent.',
  'You may mention the purchase date and, when provided, the warranty situation; never invent warranty rules and never invent store or manufacturer policies.',
  'Warranty rules: for ACTIVE you may state the product is within the registered warranty; for EXPIRED never claim coverage; for UPCOMING you may mention the warranty has not started yet; for NONE never invent a warranty.',
  'Never state that assistance will be approved and never state that a repair will be free.',
  'Preserve the meaning of the problem reported by the user; you may fix small wording issues but never change its meaning, turn a possible cause into a diagnosis or add symptoms the user did not report.',
  'Treat the warranty status provided by the system as the single source of truth.',
  'message must be a non-empty string between 20 and 2000 characters.',
].join(' ');

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

  async analyzeAssistance(input: AiAssistanceInput) {
    if (!env.aiApiUrl || !env.aiApiKey) {
      throw new AIProviderNotConfiguredError();
    }

    const response = await fetch(env.aiApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.aiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ instruction: assistanceInstruction, assistance: input }),
    }).catch(() => {
      throw new AIProviderRequestError();
    });

    if (!response.ok) throw new AIProviderRequestError();

    const payload = (await response.json().catch(() => {
      throw new AIProviderInvalidResponseError();
    })) as { data?: unknown };

    return parseJsonObject(payload.data ?? payload);
  },

  async generateAssistanceMessage(input: AiAssistanceInput) {
    if (!env.aiApiUrl || !env.aiApiKey) {
      throw new AIProviderNotConfiguredError();
    }

    const response = await fetch(env.aiApiUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.aiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        instruction: assistanceMessageInstruction,
        assistance: input,
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

  async analyzeAssistance(input) {
    void input;
    return assistanceAnalysisSchema.parse({
      summary: 'Resumo mock do problema informado.',
      possibleCauses: ['Uma possível causa.', 'Outra possível causa.'],
      recommendedAction: 'Procure assistência técnica autorizada.',
      safetyNote: 'Evite desmontar o equipamento enquanto estiver na garantia.',
      warrantyGuidance: 'Consulte os canais de assistência autorizados.',
      requiredDocuments: [
        'Nota fiscal ou comprovante de compra',
        'Documento de garantia, se disponível',
      ],
    });
  },

  async generateAssistanceMessage(input) {
    void input;
    return assistanceMessageSchema.parse({
      message:
        'Olá, gostaria de solicitar assistência técnica para o meu produto. ' +
        'Poderiam me orientar sobre como proceder?',
    });
  },
});

export const getAIProvider = (): AIProvider => {
  if (env.aiProvider === 'mock') return createMockProvider();
  if (env.aiProvider === 'http') return createHttpProvider();
  if (env.aiProvider === 'gemini') return new GeminiProvider();
  if (env.aiProvider === 'nvidia') return new NvidiaProvider();
  throw new AIProviderNotConfiguredError();
};

const isKnownAIProviderError = (error: unknown) =>
  error instanceof AIProviderNotConfiguredError ||
  error instanceof AIProviderUnsupportedFormatError ||
  error instanceof AIProviderRequestError ||
  error instanceof AIProviderInvalidResponseError;

/**
 * Defende o sistema contra respostas inválidas da IA: a categoria só é mantida
 * se for exatamente uma das categorias canônicas (PURCHASE_CATEGORIES).
 *
 * Sem comparação case-insensitive, sem correção de acentos e sem fuzzy matching:
 * qualquer valor fora da lista vira `null` (nunca é convertido em outra
 * categoria). `null`/vazio já chegam aqui como `null` (pelo schema).
 */
const normalizeCategory = (category: string | null): string | null =>
  category !== null && isPurchaseCategory(category) ? category : null;

export const extractPurchaseData = async (
  provider: AIProvider,
  document: AiDocumentInput,
): Promise<ExtractedPurchaseData> => {
  try {
    const result = await provider.extractPurchaseData(document);
    const parsed = extractedPurchaseDataSchema.parse(parseJsonObject(result));
    // Ponto central por onde passam todos os providers (Gemini, NVIDIA, HTTP e
    // mock): a categoria é normalizada aqui, garantindo o mesmo comportamento.
    return { ...parsed, category: normalizeCategory(parsed.category) };
  } catch (error) {
    if (isKnownAIProviderError(error)) throw error;

    throw new AIProviderInvalidResponseError();
  }
};

/**
 * Asks the AI for structured triage guidance and validates the answer against
 * the analysis schema. Any schema mismatch (including missing/empty fields) is
 * surfaced as an invalid-response error, never as invented fallback text.
 */
export const analyzeAssistance = async (
  provider: AIProvider,
  input: AiAssistanceInput,
): Promise<AssistanceAnalysis> => {
  try {
    const result = await provider.analyzeAssistance(input);
    return assistanceAnalysisSchema.parse(parseJsonObject(result));
  } catch (error) {
    if (isKnownAIProviderError(error)) throw error;

    throw new AIProviderInvalidResponseError();
  }
};

/**
 * Asks the AI for a ready-to-send assistance message and validates the answer
 * against the message schema. Any schema mismatch (including missing or
 * out-of-range message) is surfaced as an invalid-response error, never as
 * invented fallback text.
 */
export const generateAssistanceMessage = async (
  provider: AIProvider,
  input: AiAssistanceInput,
): Promise<AssistanceMessage> => {
  try {
    const result = await provider.generateAssistanceMessage(input);
    return assistanceMessageSchema.parse(parseJsonObject(result));
  } catch (error) {
    if (isKnownAIProviderError(error)) throw error;

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
