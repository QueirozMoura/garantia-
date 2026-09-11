import type { RequestHandler } from 'express';

import { badRequest } from '../utils/http-error.js';
import { createPurchaseSchema, updatePurchaseSchema } from './purchases.schemas.js';
import * as purchasesService from './purchases.service.js';

const getUserId = (request: Parameters<RequestHandler>[0]) => request.userId as string;

const getPurchaseId = (request: Parameters<RequestHandler>[0]) => {
  const { id } = request.params;

  if (typeof id !== 'string' || id.length === 0) {
    throw badRequest('Purchase id is required', 'PURCHASE_ID_REQUIRED');
  }

  return id;
};

export const create: RequestHandler = async (request, response, next) => {
  try {
    const input = createPurchaseSchema.parse(request.body);
    const purchase = await purchasesService.createPurchase(getUserId(request), input);
    response.status(201).json({ purchase });
  } catch (error) {
    next(error);
  }
};

export const list: RequestHandler = async (request, response, next) => {
  try {
    const purchases = await purchasesService.listPurchases(getUserId(request));
    response.json({ purchases });
  } catch (error) {
    next(error);
  }
};

export const getById: RequestHandler = async (request, response, next) => {
  try {
    const purchase = await purchasesService.getPurchase(getUserId(request), getPurchaseId(request));
    response.json({ purchase });
  } catch (error) {
    next(error);
  }
};

export const update: RequestHandler = async (request, response, next) => {
  try {
    const input = updatePurchaseSchema.parse(request.body);
    const purchase = await purchasesService.updatePurchase(
      getUserId(request),
      getPurchaseId(request),
      input,
    );
    response.json({ purchase });
  } catch (error) {
    next(error);
  }
};

export const remove: RequestHandler = async (request, response, next) => {
  try {
    await purchasesService.deletePurchase(getUserId(request), getPurchaseId(request));
    response.status(204).send();
  } catch (error) {
    next(error);
  }
};
