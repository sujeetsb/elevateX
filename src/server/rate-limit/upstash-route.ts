import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { getRedis } from '@/server/cache/redis';
import { rateLimited } from '@/server/errors/http-error';

/** Node / Route Handler rate limit (use from API routes; avoids Edge Redis bundling issues). */
export async function enforceRateLimit(identifier: string, opts?: { limit?: number; window?: `${number} m` | `${number} s` }) {
  const r = getRedis();
  if (!r) return;
  const limit = opts?.limit ?? 60;
  const window = opts?.window ?? '1 m';
  const ratelimit = new Ratelimit({
    redis: r as Redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix: 'cp:route',
  });
  const { success } = await ratelimit.limit(identifier);
  if (!success) throw rateLimited();
}
