/**
 * Base URL for real HTTP calls. Set in `.env.local`:
 * `NEXT_PUBLIC_API_BASE_URL=https://api.example.com` (no trailing slash)
 */
export function getApiBaseUrl(): string {
  const raw = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE_URL?.trim()) || '';
  return raw ? raw.replace(/\/$/, '') : '';
}

/** Default: mock on unless explicitly set to `'false'`. */
export function isMockApiEnabled(): boolean {
  if (typeof process === 'undefined') return true;
  return process.env.NEXT_PUBLIC_USE_MOCK_API !== 'false';
}
