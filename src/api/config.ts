/**
 * Base URL for real HTTP calls. Set in `.env.local`:
 * `NEXT_PUBLIC_API_BASE_URL=https://api.example.com` (no trailing slash)
 */
export function getApiBaseUrl(): string {
  const raw = (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_BASE_URL?.trim()) || '';
  if (raw) return raw.replace(/\/$/, '');
  if (typeof window !== 'undefined') return '/api';
  const origin = process.env.NEXTAUTH_URL?.trim().replace(/\/$/, '');
  return origin ? `${origin}/api` : '/api';
}

/** Mock only when explicitly enabled (Next.js app uses real same-origin API by default). */
export function isMockApiEnabled(): boolean {
  if (typeof process === 'undefined') return false;
  return process.env.NEXT_PUBLIC_USE_MOCK_API === 'true';
}
