import type { RequestHandler } from 'express';

import { badRequest } from '../utils/http-error.js';
import { extractionConfirmationSchema } from './extraction-confirmation.schemas.js';
import * as confirmationService from './extraction-confirmation.service.js';

export const confirm: RequestHandler = async (request, response, next) => {
  try {
    const { documentId } = request.params;
    if (typeof documentId !== 'string' || documentId.length === 0) {
      throw badRequest('Document id is required', 'DOCUMENT_ID_REQUIRED');
    }

    const result = await confirmationService.confirmExtraction(
      request.userId as string,
      documentId,
      extractionConfirmationSchema.parse(request.body),
    );
    response.json(result);
  } catch (error) {
    next(error);
  }
};
