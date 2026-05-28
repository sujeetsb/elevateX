/** Unified client-side API error + fetch helper. Matches server `handleApiError` JSON shape. */

export type ApiErrorCode =
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

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode | string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function parseApiError(json: unknown, fallback = 'Request failed'): string {
  if (!json || typeof json !== 'object') return fallback;
  const j = json as Record<string, unknown>;
  if (typeof j.message === 'string' && j.message.trim()) return j.message;
  const err = j.error;
  if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return fallback;
}

export function parseApiErrorDetails(json: unknown): {
  message: string;
  code?: string;
  details?: unknown;
} {
  if (!json || typeof json !== 'object') {
    return { message: 'Request failed' };
  }
  const j = json as Record<string, unknown>;
  return {
    message: parseApiError(json, 'Request failed'),
    code: typeof j.code === 'string' ? j.code : undefined,
    details: j.details,
  };
}

export type ApiFetchOptions = RequestInit & {
  /** Skip throwing on non-OK responses */
  allowError?: boolean;
};

export async function apiFetch<T = unknown>(
  input: string,
  init?: ApiFetchOptions,
): Promise<{ ok: true; data: T; status: number } | { ok: false; error: ApiError }> {
  const { allowError, ...fetchInit } = init ?? {};
  const hasBody = fetchInit.body != null;
  try {
    const res = await fetch(input, {
      credentials: 'include',
      ...fetchInit,
      headers: {
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        ...(fetchInit.headers ?? {}),
      },
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const parsed = parseApiErrorDetails(json);
      const err = new ApiError(
        res.status,
        parsed.code ?? 'INTERNAL',
        parsed.message,
        parsed.details,
      );
      if (allowError) return { ok: false, error: err };
      throw err;
    }
    const data = ((json as { data?: T })?.data ?? json) as T;
    return { ok: true, data, status: res.status };
  } catch (e) {
    if (e instanceof ApiError) throw e;
    throw new ApiError(0, 'INTERNAL', e instanceof Error ? e.message : 'Network error');
  }
}

/** Throwing shorthand for hooks and mutations. */
export async function apiFetchJson<T = unknown>(input: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch<T>(input, init);
  if (!res.ok) throw res.error;
  return res.data;
}
