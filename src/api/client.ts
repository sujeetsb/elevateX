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
type ApiEnvelope<T> = { ok?: boolean; data?: T; message?: string };

function unwrapApiResponse<T>(json: unknown): T {
  if (json && typeof json === 'object' && 'data' in json) {
    const envelope = json as ApiEnvelope<T>;
    if (envelope.data !== undefined) return envelope.data;
  }
  return json as T;
}

export async function apiRequest<T>(path: string, init: ApiRequestOptions = {}): Promise<T> {
  if (isMockApiEnabled()) {
    throw new ApiError(
      'Mock API is enabled: set NEXT_PUBLIC_USE_MOCK_API=false or disable mock helpers.',
      501,
      'MOCK_MODE',
    );
  }

  const base = getApiBaseUrl();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const headers = new Headers(init.headers);

  if (!init.rawBody && init.body != null && !(init.body instanceof FormData)) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
  }

  const res = await fetch(url, { ...init, headers, credentials: init.credentials ?? 'include' });
  if (!res.ok) {
    throw await parseErrorResponse(res);
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }

  const ct = res.headers.get('content-type');
  if (ct?.includes('application/json')) {
    return unwrapApiResponse<T>(await res.json());
  }

  return (await res.text()) as unknown as T;
}
