export type ApiErrorBody = {
  message?: string;
  code?: string;
  details?: unknown;
};

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly body?: unknown;

  constructor(message: string, status: number, code: string, body?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

export async function parseErrorResponse(res: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = undefined;
  }
  const b = body as ApiErrorBody | undefined;
  const message = b?.message || res.statusText || 'Request failed';
  const code = b?.code || `HTTP_${res.status}`;
  return new ApiError(message, res.status, code, body);
}
