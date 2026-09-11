import type { RequestHandler } from 'express';

import { verifyAccessToken } from '../config/jwt.js';
import { unauthorized } from '../utils/http-error.js';

export const requireAuth: RequestHandler = (request, _response, next) => {
  const authorization = request.header('Authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : undefined;

  if (!token) {
    next(unauthorized('Authentication required', 'AUTH_REQUIRED'));
    return;
  }

  try {
    const payload = verifyAccessToken(token);

    if (typeof payload.userId !== 'string') {
      throw new Error('Invalid access token');
    }

    request.userId = payload.userId;
    next();
  } catch {
    next(unauthorized('Invalid or expired access token', 'INVALID_ACCESS_TOKEN'));
  }
};
