export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code ?? 'REQUEST_ERROR';
    Error.captureStackTrace?.(this, HttpError);
  }
}

export const badRequest = (message: string, code?: string) => new HttpError(400, message, code);

export const unauthorized = (message: string, code?: string) => new HttpError(401, message, code);

export const forbidden = (message: string, code?: string) => new HttpError(403, message, code);

export const notFound = (message: string, code?: string) => new HttpError(404, message, code);

export const conflict = (message: string, code?: string) => new HttpError(409, message, code);
