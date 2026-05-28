import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SalaryInsightsData } from '@/components/SalaryIntelligence';
import { apiFetchJson } from '@/lib/api/client';
import { insightsQueryKeys } from '@/lib/insights/query-keys';
import type { NormalizedProfileInsights } from '@/lib/insights/normalize';

async function fetchSalaryInsights(): Promise<SalaryInsightsData> {
  return apiFetchJson<SalaryInsightsData>('/api/v1/ai/salary-insights');
}

function salaryFromProfileInsights(insights: NormalizedProfileInsights | undefined): SalaryInsightsData | undefined {
  const raw = insights?.salaryInsights;
  if (!raw || typeof raw !== 'object' || Object.keys(raw).length === 0) return undefined;
  return raw as SalaryInsightsData;
}

/** Cached salary insights — seeded from UserInsights cache when available. */
export function useSalaryInsights(profileVersion = 0) {
  const qc = useQueryClient();
  const cachedProfile = qc.getQueryData<NormalizedProfileInsights>(
    insightsQueryKeys.profile(profileVersion),
  );
  const seeded = salaryFromProfileInsights(cachedProfile);

  return useQuery({
    queryKey: insightsQueryKeys.salary(profileVersion),
    queryFn: fetchSalaryInsights,
    placeholderData: seeded,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: !seeded,
  });
}

/** @deprecated Prefer useProfileInsights from use-profile-insights.ts */
export function useUserInsights(profileVersion = 0) {
  return useQuery({
    queryKey: insightsQueryKeys.profile(profileVersion),
    queryFn: async () => apiFetchJson('/api/v1/insights'),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });
}

export type ResumeMetaRow = {
  id: string;
  title: string;
  parseStatus: string;
  parsedJson?: Record<string, unknown> | null;
  atsScore: number | null;
  updatedAt: string;
  createdAt: string;
};

export function useResumesMeta(enabled = true) {
  return useQuery({
    queryKey: insightsQueryKeys.resumesMeta(),
    queryFn: async () => {
      const list = await apiFetchJson<ResumeMetaRow[]>('/api/v1/resumes?meta=1');
      return Array.isArray(list) ? list : [];
    },
    staleTime: 2 * 60_000,
    enabled,
  });
}
