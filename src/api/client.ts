import { getApiBaseUrl, isMockApiEnabled } from './config';
import { ApiError, parseErrorResponse } from './errors';

export type ApiRequestOptions = RequestInit & {
  /** When true, never attach JSON Content-Type (use with FormData). */
  rawBody?: boolean;
};

/**
 * Typed fetch for production. Throws {@link ApiError} on non-2xx.
 * When {@link isMockApiEnabled} is true, this is not used by domain helpers — call mock-specific functions instead.
 */
export async function apiRequest<T>(path: string, init: ApiRequestOptions = {}): Promise<T> {
  if (isMockApiEnabled()) {
    throw new ApiError(
      'Mock API is enabled: use typed helpers (e.g. parseResumeFile) or set VITE_USE_MOCK_API=false with VITE_API_BASE_URL.',
      501,
      'MOCK_MODE',
    );
  }

  const base = getApiBaseUrl();
  if (!base) {
    throw new ApiError('Missing VITE_API_BASE_URL while mock mode is disabled.', 0, 'MISSING_BASE_URL');
  }

  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(init.headers);

  if (!init.rawBody && init.body != null && !(init.body instanceof FormData)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    throw await parseErrorResponse(res);
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }

  const ct = res.headers.get('content-type');
  if (ct?.includes('application/json')) {
    return (await res.json()) as T;
  }

  return (await res.text()) as unknown as T;
}
