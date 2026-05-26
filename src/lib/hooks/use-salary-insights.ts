import { useQuery } from '@tanstack/react-query';
import type { SalaryInsightsData } from '@/components/SalaryIntelligence';

async function fetchSalaryInsights(): Promise<SalaryInsightsData> {
  const res = await fetch('/api/v1/ai/salary-insights', { credentials: 'include' });
  const json = await res.json();
  if (!res.ok) throw new Error(json?.message ?? 'Failed to load salary insights');
  return (json.data ?? null) as SalaryInsightsData;
}

/** Cached salary insights — keyed by profileVersion so profile edits refetch once. */
export function useSalaryInsights(profileVersion = 0) {
  return useQuery({
    queryKey: ['salary-insights', profileVersion],
    queryFn: fetchSalaryInsights,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

export function useUserInsights(profileVersion = 0) {
  return useQuery({
    queryKey: ['user-insights', profileVersion],
    queryFn: async () => {
      const res = await fetch('/api/v1/insights', { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? 'Failed to load insights');
      return json.data;
    },
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export function useResumesMeta(enabled = true) {
  return useQuery({
    queryKey: ['resumes', 'meta'],
    queryFn: async () => {
      const res = await fetch('/api/v1/resumes?meta=1', { credentials: 'include' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message ?? 'Failed to load resumes');
      return Array.isArray(json.data) ? json.data : [];
    },
    staleTime: 2 * 60_000,
    enabled,
  });
}
