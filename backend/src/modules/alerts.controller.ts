import type { RequestHandler } from 'express';

import * as alertsService from './alerts.service.js';

const getUserId = (request: Parameters<RequestHandler>[0]) => request.userId as string;

export const list: RequestHandler = async (request, response, next) => {
  try {
    const alerts = await alertsService.listAlerts(getUserId(request));
    response.json({ alerts });
  } catch (error) {
    next(error);
  }
};
