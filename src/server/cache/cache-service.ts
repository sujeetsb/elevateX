import { getRedis } from './redis';
import { cacheKeys } from './cache-keys';
import { logger } from '@/server/logger';

const DEFAULT_TTL_SEC = 300;

export class CacheService {
  async getJson<T>(key: string): Promise<T | null> {
    const r = getRedis();
    if (!r) return null;
    try {
      const raw = await r.get<string>(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (e) {
      logger.warn('cache.get failed', { key, error: String(e) });
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSec = DEFAULT_TTL_SEC): Promise<void> {
    const r = getRedis();
    if (!r) return;
    try {
      await r.set(key, JSON.stringify(value), { ex: ttlSec });
    } catch (e) {
      logger.warn('cache.set failed', { key, error: String(e) });
    }
  }

  async del(...keys: string[]): Promise<void> {
    const r = getRedis();
    if (!r || keys.length === 0) return;
    try {
      await r.del(...keys);
    } catch (e) {
      logger.warn('cache.del failed', { keys, error: String(e) });
    }
  }

  /** Invalidate user-scoped recommendation caches */
  async invalidateUser(userId: string): Promise<void> {
    await this.del(
      cacheKeys.userProfile(userId),
      cacheKeys.userSkills(userId),
      cacheKeys.jobRecommendations(userId),
      cacheKeys.learningRecommendations(userId),
      cacheKeys.profileAnalytics(userId),
    );
  }
}

export const cacheService = new CacheService();
