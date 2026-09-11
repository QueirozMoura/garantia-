import type { RequestHandler } from 'express';

import { badRequest } from '../utils/http-error.js';
import { extractPurchaseData, getAIProvider, publicAIError } from '../services/ai/ai.service.js';
import * as documentsService from './documents.service.js';

const getDocumentId = (request: Parameters<RequestHandler>[0]) => {
  const { documentId } = request.params;
  if (typeof documentId !== 'string' || documentId.length === 0) {
    throw badRequest('Document id is required', 'DOCUMENT_ID_REQUIRED');
  }
  return documentId;
};

export const extract: RequestHandler = async (request, response, next) => {
  try {
    const { document, buffer } = await documentsService.getOwnedDocumentForAI(
      request.userId as string,
      getDocumentId(request),
    );
    const provider = getAIProvider();
    const result = await extractPurchaseData(provider, {
      content: buffer,
      mimeType: document.mimeType as 'application/pdf' | 'image/jpeg' | 'image/png',
      fileName: document.fileName,
    });
    response.json({ data: result });
  } catch (error) {
    next(publicAIError(error) ?? error);
  }
};
