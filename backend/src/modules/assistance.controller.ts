import type { RequestHandler } from 'express';

import { badRequest } from '../utils/http-error.js';
import { purchaseIdSchema } from './purchases.schemas.js';
import { assistanceRequestSchema } from './assistance.schemas.js';
import * as assistanceService from './assistance.service.js';

const getUserId = (request: Parameters<RequestHandler>[0]) => request.userId as string;

const getPurchaseId = (request: Parameters<RequestHandler>[0]) => {
  const { purchaseId } = request.params;

  if (typeof purchaseId !== 'string' || purchaseId.length === 0) {
    throw badRequest('Purchase id is required', 'PURCHASE_ID_REQUIRED');
  }

  // Reject non-UUID ids here so they never reach the service/Prisma layer.
  if (!purchaseIdSchema.safeParse(purchaseId).success) {
    throw badRequest('Invalid purchase ID', 'INVALID_PURCHASE_ID');
  }

  return purchaseId;
};

export const prepare: RequestHandler = async (request, response, next) => {
  try {
    const assistance = await assistanceService.prepareAssistance(
      getUserId(request),
      getPurchaseId(request),
      assistanceRequestSchema.parse(request.body),
    );
    response.json({ assistance });
  } catch (error) {
    next(error);
  }
};
