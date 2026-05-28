import { useQuery } from '@tanstack/react-query';
import { apiFetchJson } from '@/lib/api/client';
import { insightsQueryKeys } from '@/lib/insights/query-keys';

export type WeeklyStudyHoursResponse = {
  days: Array<{ day: string; hours: number }>;
  averageHoursPerDay: number;
  weeklyStudyHours: number;
  targetWeeklyHours: number | null;
};

export function useWeeklyStudyHours(enabled = true) {
  return useQuery<WeeklyStudyHoursResponse>({
    queryKey: insightsQueryKeys.weeklyStudy(),
    queryFn: async () => {
      const data = await apiFetchJson<WeeklyStudyHoursResponse>('/api/v1/analytics/weekly-study-hours');
      return data ?? {
        days: [],
        averageHoursPerDay: 0,
        weeklyStudyHours: 0,
        targetWeeklyHours: null,
      };
    },
    staleTime: 60_000,
    enabled,
  });
}
