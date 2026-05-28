import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetchJson } from '@/lib/api/client';
import { normalizeUserInsights, type NormalizedProfileInsights } from '@/lib/insights/normalize';
import { insightsQueryKeys } from '@/lib/insights/query-keys';

async function fetchProfileInsights(profileVersion: number): Promise<NormalizedProfileInsights> {
  const raw = await apiFetchJson<Record<string, unknown>>('/api/v1/insights');
  return normalizeUserInsights(raw, {
    cached: Boolean(raw?.cached),
    profileVersion: Number(raw?.profileVersion ?? profileVersion),
  });
}

/** Single source of truth for UserInsights on the client. */
export function useProfileInsights(profileVersion = 0, enabled = true) {
  return useQuery({
    queryKey: insightsQueryKeys.profile(profileVersion),
    queryFn: () => fetchProfileInsights(profileVersion),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    enabled,
  });
}

export function usePrefetchProfileInsights() {
  const qc = useQueryClient();
  return (profileVersion = 0) =>
    qc.prefetchQuery({
      queryKey: insightsQueryKeys.profile(profileVersion),
      queryFn: () => fetchProfileInsights(profileVersion),
      staleTime: 5 * 60_000,
    });
}
