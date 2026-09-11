import type { RequestHandler } from 'express';

import * as dashboardService from './dashboard.service.js';

const getUserId = (request: Parameters<RequestHandler>[0]) => request.userId as string;

export const get: RequestHandler = async (request, response, next) => {
  try {
    const dashboard = await dashboardService.getDashboard(getUserId(request));
    response.json({ dashboard });
  } catch (error) {
    next(error);
  }
};
