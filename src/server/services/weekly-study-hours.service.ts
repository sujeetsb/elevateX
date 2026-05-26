import { prisma } from '@/server/db/prisma';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

function startOfWeekUtc(d = new Date()): Date {
  const date = new Date(d);
  const day = date.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  date.setUTCDate(date.getUTCDate() + diffToMonday);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function dayIndexFromDate(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 6 : day - 1;
}

export type WeeklyStudyHoursPayload = {
  days: Array<{ day: (typeof DAY_LABELS)[number]; hours: number }>;
  averageHoursPerDay: number;
  weeklyStudyHours: number;
  targetWeeklyHours: number | null;
};

export async function recomputeWeeklyStudyHours(userId: string): Promise<WeeklyStudyHoursPayload> {
  const weekStart = startOfWeekUtc();

  const [lessonProgress, roadmapProgress, learningPref, analytics] = await Promise.all([
    prisma.lessonProgress.findMany({
      where: {
        completed: true,
        completedAt: { gte: weekStart },
        userCourse: { userId },
      },
      select: {
        completedAt: true,
        timeSpentMinutes: true,
        lesson: { select: { duration: true } },
      },
    }),
    prisma.learningProgress.findMany({
      where: {
        userId,
        completed: true,
        updatedAt: { gte: weekStart },
      },
      select: { updatedAt: true },
    }),
    prisma.learningPreference.findUnique({
      where: { userId },
      select: { weeklyHours: true },
    }),
    prisma.userAnalytics.findUnique({
      where: { userId },
      select: { snapshot: true },
    }),
  ]);

  const minsByDay = [0, 0, 0, 0, 0, 0, 0];

  for (const lp of lessonProgress) {
    const completedAt = lp.completedAt ?? weekStart;
    const fallbackMins = Number(lp.lesson?.duration?.match(/\d+/)?.[0] ?? 10);
    const mins = Math.max(1, Number(lp.timeSpentMinutes || fallbackMins || 10));
    minsByDay[dayIndexFromDate(completedAt)] += mins;
  }

  for (const rp of roadmapProgress) {
    minsByDay[dayIndexFromDate(rp.updatedAt)] += 10;
  }

  const days = DAY_LABELS.map((day, idx) => ({
    day,
    hours: Number((minsByDay[idx] / 60).toFixed(1)),
  }));
  const weeklyStudyHours = Number((minsByDay.reduce((a, b) => a + b, 0) / 60).toFixed(1));
  const averageHoursPerDay = Number((weeklyStudyHours / 7).toFixed(1));

  const prevSnapshot =
    analytics?.snapshot && typeof analytics.snapshot === 'object'
      ? (analytics.snapshot as Record<string, unknown>)
      : {};
  await prisma.userAnalytics.upsert({
    where: { userId },
    create: {
      userId,
      snapshot: {
        ...prevSnapshot,
        weeklyStudyHours,
        weeklyStudyHoursUpdatedAt: new Date().toISOString(),
      },
    },
    update: {
      snapshot: {
        ...prevSnapshot,
        weeklyStudyHours,
        weeklyStudyHoursUpdatedAt: new Date().toISOString(),
      },
    },
  });

  return {
    days,
    averageHoursPerDay,
    weeklyStudyHours,
    targetWeeklyHours: learningPref?.weeklyHours ?? null,
  };
}
