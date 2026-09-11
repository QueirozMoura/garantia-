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

const redactDiagnosticText = (value: string) =>
  value
    .replace(
      /(gemini[_-]?api[_-]?key|api[_-]?key|authorization|bearer|access[_-]?token|refresh[_-]?token)\s*[:=]\s*["']?[^,\s"']+/gi,
      '$1=[REDACTED]',
    )
    .replace(/\b(?:AIza[0-9A-Za-z_-]{20,}|AQ\.[0-9A-Za-z_-]{20,})\b/g, '[REDACTED]')
    .slice(0, 2000);

const diagnosticDetails = (error: unknown, depth = 0): unknown => {
  if (depth > 2 || !(error instanceof Error)) return undefined;

  const details: { name: string; message: string; stack?: string; cause?: unknown } = {
    name: error.name,
    message: redactDiagnosticText(error.message),
  };
  if (error.stack) details.stack = redactDiagnosticText(error.stack);
  if (error.cause) details.cause = diagnosticDetails(error.cause, depth + 1);
  return details;
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

  if (isServerError) {
    console.error('[error-handler] Internal error:', diagnosticDetails(error));
  }

  response.status(status).json({
    error: {
      message: isServerError ? 'Something went wrong' : error.message,
      code: isServerError ? 'INTERNAL_ERROR' : (error.code ?? 'REQUEST_ERROR'),
    },
  });
};
