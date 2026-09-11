import type { RequestHandler } from 'express';

import { refreshTokenCookieName, refreshTokenCookieOptions } from '../config/jwt.js';
import { unauthorized } from '../utils/http-error.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import * as authService from './auth.service.js';

export const register: RequestHandler = async (request, response, next) => {
  try {
    const input = registerSchema.parse(request.body);
    const user = await authService.register(input);
    response.status(201).json({ user });
  } catch (error) {
    next(error);
  }
};

export const login: RequestHandler = async (request, response, next) => {
  try {
    const input = loginSchema.parse(request.body);
    const { user, accessToken, refreshToken } = await authService.login(input);
    response.cookie(refreshTokenCookieName, refreshToken, refreshTokenCookieOptions);
    response.json({ user, accessToken });
  } catch (error) {
    next(error);
  }
};

export const refresh: RequestHandler = (request, response, next) => {
  try {
    const refreshToken = request.cookies?.[refreshTokenCookieName];

    if (typeof refreshToken !== 'string' || refreshToken.length === 0) {
      throw unauthorized('Refresh token is required', 'REFRESH_TOKEN_REQUIRED');
    }

    response.json({ accessToken: authService.refresh(refreshToken) });
  } catch (error) {
    next(error);
  }
};

export const logout: RequestHandler = (_request, response) => {
  response.clearCookie(refreshTokenCookieName, {
    ...refreshTokenCookieOptions,
    maxAge: undefined,
  });
  response.status(204).send();
};

export const me: RequestHandler = async (request, response, next) => {
  try {
    const user = await authService.getMe(request.userId as string);
    response.json({ user });
  } catch (error) {
    next(error);
  }
};
