import { cacheService } from '@/server/cache/cache-service';
import { cacheKeys } from '@/server/cache/cache-keys';

/** Drop cached /api/v1/me payload so the next read reflects DB changes. */
export async function invalidateUserProfileCache(userId: string) {
  await cacheService.del(
    cacheKeys.userProfile(userId),
    cacheKeys.jobRecommendations(userId),
    cacheKeys.learningRecommendations(userId),
    cacheKeys.profileAnalytics(userId),
  );
}
