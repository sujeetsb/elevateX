/** Central React Query keys for profile intelligence. */
export const insightsQueryKeys = {
  all: ['user-insights'] as const,
  profile: (profileVersion: number) => ['user-insights', profileVersion] as const,
  salary: (profileVersion: number) => ['salary-insights', profileVersion] as const,
  resumesMeta: () => ['resumes', 'meta'] as const,
  weeklyStudy: () => ['analytics', 'weekly-study-hours'] as const,
  profileAnalytics: () => ['analytics', 'profile'] as const,
};

export function invalidateInsightsQueries(
  queryClient: { invalidateQueries: (opts: { queryKey: readonly unknown[] }) => Promise<void> },
  profileVersion?: number,
) {
  const tasks = [
    queryClient.invalidateQueries({ queryKey: insightsQueryKeys.all }),
    queryClient.invalidateQueries({ queryKey: insightsQueryKeys.resumesMeta() }),
    queryClient.invalidateQueries({ queryKey: insightsQueryKeys.profileAnalytics() }),
  ];
  if (profileVersion != null) {
    tasks.push(
      queryClient.invalidateQueries({ queryKey: insightsQueryKeys.profile(profileVersion) }),
      queryClient.invalidateQueries({ queryKey: insightsQueryKeys.salary(profileVersion) }),
    );
  } else {
    tasks.push(
      queryClient.invalidateQueries({ queryKey: ['salary-insights'] }),
      queryClient.invalidateQueries({ queryKey: ['user-insights'] }),
    );
  }
  return Promise.all(tasks);
}
