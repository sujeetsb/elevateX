import { useQuery } from '@tanstack/react-query';
import { apiFetchJson } from '@/lib/api/client';
import { insightsQueryKeys } from '@/lib/insights/query-keys';
import type { ProfileAnalyticsPayload } from '@/server/services/profile-analytics.service';

export const profileAnalyticsQueryKey = insightsQueryKeys.profileAnalytics();

async function fetchProfileAnalytics(): Promise<ProfileAnalyticsPayload> {
  return apiFetchJson<ProfileAnalyticsPayload>('/api/v1/analytics/profile');
}

export function useProfileAnalytics(enabled = true) {
  return useQuery({
    queryKey: profileAnalyticsQueryKey,
    queryFn: fetchProfileAnalytics,
    staleTime: 2 * 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    enabled,
  });
}
