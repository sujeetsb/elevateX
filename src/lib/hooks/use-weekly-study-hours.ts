import { useQuery } from '@tanstack/react-query';

export type WeeklyStudyHoursResponse = {
  days: Array<{ day: string; hours: number }>;
  averageHoursPerDay: number;
  weeklyStudyHours: number;
  targetWeeklyHours: number | null;
};

export function useWeeklyStudyHours() {
  return useQuery<WeeklyStudyHoursResponse>({
    queryKey: ['analytics', 'weekly-study-hours'],
    queryFn: async () => {
      const res = await fetch('/api/v1/analytics/weekly-study-hours', { credentials: 'include' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (json?.error && typeof json.error.message === 'string' && json.error.message)
          || 'Could not load weekly study hours.',
        );
      }
      return (json?.data ?? {
        days: [],
        averageHoursPerDay: 0,
        weeklyStudyHours: 0,
        targetWeeklyHours: null,
      }) as WeeklyStudyHoursResponse;
    },
    staleTime: 60_000,
  });
}
