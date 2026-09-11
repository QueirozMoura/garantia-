import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

interface ErrorWithStatus extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
}

const statusByName: Record<string, number> = {
  UnauthorizedError: 401,
  ForbiddenError: 403,
  NotFoundError: 404,
  ConflictError: 409,
};

export const notFoundHandler: RequestHandler = (request, response) => {
  response.status(404).json({
    error: {
      message: `Route ${request.method} ${request.originalUrl} not found`,
      code: 'NOT_FOUND',
    },
  });
};

export const errorHandler: ErrorRequestHandler = (
  error: ErrorWithStatus | ZodError,
  _request,
  response,
  _next,
) => {
  void _next;

  if (error instanceof ZodError) {
    response.status(400).json({
      error: {
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        issues: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      },
    });
    return;
  }

  const status = error.statusCode ?? error.status ?? statusByName[error.name] ?? 500;
  const isServerError = status >= 500;

  response.status(status).json({
    error: {
      message: isServerError ? 'Something went wrong' : error.message,
      code: isServerError ? 'INTERNAL_ERROR' : (error.code ?? 'REQUEST_ERROR'),
    },
  });
};
