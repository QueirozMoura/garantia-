import type { RequestHandler } from 'express';

import { badRequest } from '../utils/http-error.js';
import { createWarrantySchema, updateWarrantySchema } from './warranties.schemas.js';
import * as warrantiesService from './warranties.service.js';

const getUserId = (request: Parameters<RequestHandler>[0]) => request.userId as string;

const getPurchaseId = (request: Parameters<RequestHandler>[0]) => {
  const { purchaseId } = request.params;

  if (typeof purchaseId !== 'string' || purchaseId.length === 0) {
    throw badRequest('Purchase id is required', 'PURCHASE_ID_REQUIRED');
  }

  return purchaseId;
};

export const create: RequestHandler = async (request, response, next) => {
  try {
    const warranty = await warrantiesService.createWarranty(
      getUserId(request),
      getPurchaseId(request),
      createWarrantySchema.parse(request.body),
    );
    response.status(201).json({ warranty });
  } catch (error) {
    next(error);
  }
};

export const list: RequestHandler = async (request, response, next) => {
  try {
    const warranties = await warrantiesService.listWarranties(getUserId(request));
    response.json({ warranties });
  } catch (error) {
    next(error);
  }
};

export const get: RequestHandler = async (request, response, next) => {
  try {
    const warranty = await warrantiesService.getWarranty(
      getUserId(request),
      getPurchaseId(request),
    );
    response.json({ warranty });
  } catch (error) {
    next(error);
  }
};

export const update: RequestHandler = async (request, response, next) => {
  try {
    const warranty = await warrantiesService.updateWarranty(
      getUserId(request),
      getPurchaseId(request),
      updateWarrantySchema.parse(request.body),
    );
    response.json({ warranty });
  } catch (error) {
    next(error);
  }
};

export const remove: RequestHandler = async (request, response, next) => {
  try {
    await warrantiesService.deleteWarranty(getUserId(request), getPurchaseId(request));
    response.status(204).send();
  } catch (error) {
    next(error);
  }
};
