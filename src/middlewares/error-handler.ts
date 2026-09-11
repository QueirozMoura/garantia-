import type { ErrorRequestHandler, RequestHandler } from 'express';

interface ErrorWithStatus extends Error {
  status?: number;
  statusCode?: number;
  code?: string;
}

export const notFoundHandler: RequestHandler = (request, response) => {
  response.status(404).json({
    error: {
      message: `Route ${request.method} ${request.originalUrl} not found`,
      code: 'NOT_FOUND',
    },
  });
};

export const errorHandler: ErrorRequestHandler = (
  error: ErrorWithStatus,
  _request,
  response,
  _next,
) => {
  void _next;

  const status = error.statusCode ?? error.status ?? 500;
  const isServerError = status >= 500;

  response.status(status).json({
    error: {
      message: isServerError ? 'Something went wrong' : error.message,
      code: isServerError ? 'INTERNAL_ERROR' : (error.code ?? 'REQUEST_ERROR'),
    },
  });
};
