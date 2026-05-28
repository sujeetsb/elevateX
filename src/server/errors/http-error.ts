export type ErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'USER_NOT_REGISTERED'
  | 'INSUFFICIENT_XP'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL'
  | 'SERVICE_UNAVAILABLE';

export class HttpError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (msg: string, details?: unknown) => new HttpError(400, 'BAD_REQUEST', msg, details);
export const unauthorized = (msg = 'Unauthorized') => new HttpError(401, 'UNAUTHORIZED', msg);
export const forbidden = (msg = 'Forbidden') => new HttpError(403, 'FORBIDDEN', msg);
export const notFound = (msg = 'Not found') => new HttpError(404, 'NOT_FOUND', msg);
export const userNotRegistered = (msg = 'Your account is not registered. Please sign up.') =>
  new HttpError(404, 'USER_NOT_REGISTERED', msg);
export const insufficientXp = (msg = 'Not enough XP', details?: unknown) =>
  new HttpError(402, 'INSUFFICIENT_XP', msg, details);
export const conflict = (msg: string) => new HttpError(409, 'CONFLICT', msg);
export const rateLimited = (msg = 'Too many requests') => new HttpError(429, 'RATE_LIMITED', msg);
export const internal = (msg = 'Internal server error') => new HttpError(500, 'INTERNAL', msg);
export const serviceUnavailable = (msg = 'Service temporarily unavailable') =>
  new HttpError(503, 'SERVICE_UNAVAILABLE', msg);
