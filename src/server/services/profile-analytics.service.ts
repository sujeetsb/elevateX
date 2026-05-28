import { ActivityVerb, ApplicationStatus } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { getGamificationFromSnapshot } from '@/server/gamification/gamification.service';
import { getLatestResumeForDisplay } from '@/server/services/latest-resume.service';
import { calculateLevel } from '@/lib/gamification/levels';
import {
  ensureAnalyticsHistoryBackfill,
  salaryTrendFromHistory,
  skillGrowthFromHistory,
} from '@/server/services/analytics-history.service';

export type ProfileAnalyticsPayload = {
  atsScore: number | null;
  atsTrend: Array<{ label: string; score: number }>;
  atsDelta: number | null;
  resumeSuggestions: string[];
  xp: number;
  streak: number;
  level: number;
  levelName: string;
  xpTrend: Array<{ label: string; xp: number }>;
  skillsRadar: Array<{ skill: string; value: number }>;
  skillsGap: string[];
  courses: {
    total: number;
    completed: number;
    inProgress: number;
    avgProgress: number;
  };
  jobApplications: {
    total: number;
    applied: number;
    interview: number;
    offer: number;
  };
  salary: {
    current: string | null;
    goal: string | null;
    currency: string;
    goalCurrency: string;
  };
  salaryTrend: Array<{ label: string; current: number | null; goal: number | null }>;
  skillGrowthTrend: Array<Record<string, string | number>>;
  roadmap: {
    hasRoadmap: boolean;
    totalResources: number;
    completedResources: number;
    progressPct: number;
  };
  careerReadiness: Array<{ label: string; score: number }>;
  profileCompletion: number;
};

function weekLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function skillProficiency(priority: string): number {
  const p = priority.toLowerCase();
  if (p === 'critical') return 35;
  if (p === 'high') return 50;
  if (p === 'medium') return 65;
  return 78;
}

function computeProfileCompletion(profile: {
  currentRole?: string | null;
  bio?: string | null;
  education?: string | null;
  linkedInUrl?: string | null;
  githubUrl?: string | null;
  targetRole?: string | null;
}, skillCount: number, certCount: number, resumeParsed: boolean): number {
  let score = 0;
  if (profile.currentRole?.trim()) score += 15;
  if (profile.bio?.trim()) score += 10;
  if (profile.education?.trim()) score += 10;
  if (profile.linkedInUrl?.trim()) score += 10;
  if (profile.githubUrl?.trim()) score += 10;
  if (profile.targetRole?.trim()) score += 10;
  if (skillCount >= 3) score += 15;
  if (certCount > 0) score += 10;
  if (resumeParsed) score += 20;
  return Math.min(100, score);
}

export async function getProfileAnalytics(userId: string): Promise<ProfileAnalyticsPayload> {
  const [
    profile,
    latestResume,
    skills,
    certifications,
    enrollments,
    applications,
    roadmap,
    roadmapProgress,
    parseLogs,
    xpEvents,
    insights,
  ] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    getLatestResumeForDisplay(userId),
    prisma.userSkill.findMany({
      where: { userId },
      take: 12,
      include: { skill: true },
    }),
    prisma.userCertification.count({ where: { userId } }),
    prisma.userCourse.findMany({
      where: { userId },
      select: { progressPct: true, status: true },
    }),
    prisma.jobApplication.findMany({
      where: { userId, deletedAt: null },
      select: { status: true },
    }),
    prisma.learningRoadmap.findFirst({
      where: { userId, deletedAt: null, status: 'ACTIVE' },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, jsonPlan: true },
    }),
    prisma.learningProgress.findMany({
      where: { userId },
      select: { completed: true, progressPct: true, roadmapId: true },
    }),
    prisma.activityLog.findMany({
      where: { userId, verb: ActivityVerb.RESUME_PARSE },
      orderBy: { createdAt: 'asc' },
      take: 12,
      select: { createdAt: true, metadata: true },
    }),
    prisma.gamificationEvent.findMany({
      where: { userId, xpAmount: { gt: 0 } },
      orderBy: { createdAt: 'asc' },
      take: 80,
      select: { createdAt: true, xpAmount: true },
    }),
    prisma.userInsights.findUnique({
      where: { userId },
      select: { skillsGap: true },
    }),
  ]);

  const resolvedAtsScore = latestResume?.atsScore ?? null;
  const gamification = await getGamificationFromSnapshot({
    userId,
    latestResumeAtsScore: resolvedAtsScore,
  });

  const history = await ensureAnalyticsHistoryBackfill(userId);

  const { level, levelName } = calculateLevel(gamification.xp);

  const atsTrend = parseLogs
    .map(log => {
      const meta = log.metadata as { atsScore?: number } | null;
      const score = meta?.atsScore;
      if (score == null || !Number.isFinite(score)) return null;
      return { label: weekLabel(log.createdAt), score: Math.round(score) };
    })
    .filter(Boolean) as Array<{ label: string; score: number }>;

  if (resolvedAtsScore != null && (atsTrend.length === 0 || atsTrend[atsTrend.length - 1]?.score !== Math.round(resolvedAtsScore))) {
    atsTrend.push({
      label: latestResume?.lastParsedAt ? weekLabel(latestResume.lastParsedAt) : 'Now',
      score: Math.round(resolvedAtsScore),
    });
  }

  const atsDelta =
    atsTrend.length >= 2 ? atsTrend[atsTrend.length - 1].score - atsTrend[0].score : null;

  const gapItems = Array.isArray(insights?.skillsGap)
    ? (insights.skillsGap as Array<{ skill?: string; priority?: string }>)
    : [];
  const skillsGap = gapItems.map(g => String(g.skill ?? '').trim()).filter(Boolean).slice(0, 8);

  const resumeSuggestions = gapItems
    .slice(0, 5)
    .map(g => `Improve ${g.skill}: ${g.priority ?? 'medium'} priority skill gap`);

  const skillsRadarFromProfile = skills.map((us, i) => ({
    skill: us.skill.label,
    value: Math.min(95, 55 + i * 4),
  }));

  const skillsRadarFromGaps = gapItems.slice(0, 6).map(g => ({
    skill: String(g.skill ?? '').trim(),
    value: skillProficiency(String(g.priority ?? 'medium')),
  }));

  const skillsRadar =
    skillsRadarFromProfile.length >= 3
      ? skillsRadarFromProfile
      : skillsRadarFromGaps.length >= 3
        ? skillsRadarFromGaps
        : skillsRadarFromProfile;

  const completedCourses = enrollments.filter(e => e.status === 'COMPLETED' || e.progressPct >= 100).length;
  const inProgress = enrollments.filter(e => e.progressPct > 0 && e.progressPct < 100).length;
  const avgProgress =
    enrollments.length > 0
      ? Math.round(enrollments.reduce((s, e) => s + e.progressPct, 0) / enrollments.length)
      : 0;

  const appByStatus = (status: ApplicationStatus) =>
    applications.filter(a => a.status === status).length;

  let runningXp = 0;
  const xpByWeek = new Map<string, number>();
  for (const ev of xpEvents) {
    runningXp += ev.xpAmount;
    const key = weekLabel(ev.createdAt);
    xpByWeek.set(key, runningXp);
  }
  const xpTrend =
    history.xpHistory.length > 0
      ? history.xpHistory.slice(-7).map(p => ({
          label: p.date.slice(5),
          xp: p.xp,
        }))
      : xpByWeek.size > 0
        ? [...xpByWeek.entries()].slice(-7).map(([label, xpVal]) => ({ label, xp: xpVal }))
        : [{ label: 'Now', xp: gamification.xp }];

  const salaryTrend = salaryTrendFromHistory(history.salaryHistory);
  const skillGrowthTrend = skillGrowthFromHistory(history.skillHistory);

  const roadmapProgressFiltered = roadmap
    ? roadmapProgress.filter(p => p.roadmapId === roadmap.id)
    : roadmapProgress;

  const totalResources = roadmapProgressFiltered.length;
  const completedResources = roadmapProgressFiltered.filter(p => p.completed).length;
  const progressPct =
    totalResources > 0 ? Math.round((completedResources / totalResources) * 100) : 0;

  const resumeParsed = latestResume?.parseStatus === 'COMPLETE';
  const profileCompletion = computeProfileCompletion(
    profile ?? {},
    skills.length,
    certifications,
    resumeParsed,
  );

  const readinessNow = Math.round(
    profileCompletion * 0.35 +
      Math.min(100, resolvedAtsScore ?? 0) * 0.35 +
      avgProgress * 0.15 +
      progressPct * 0.15,
  );

  const careerReadiness = atsTrend.length >= 2
    ? atsTrend.map((pt, i) => ({
        label: pt.label,
        score: Math.min(100, Math.round(readinessNow * ((i + 1) / atsTrend.length))),
      }))
    : [
        { label: 'Start', score: Math.max(20, readinessNow - 15) },
        { label: 'Now', score: readinessNow },
      ];

  return {
    atsScore: resolvedAtsScore,
    atsTrend,
    atsDelta,
    resumeSuggestions,
    xp: gamification.xp,
    streak: gamification.streak,
    level,
    levelName,
    xpTrend,
    skillsRadar,
    skillsGap,
    courses: {
      total: enrollments.length,
      completed: completedCourses,
      inProgress,
      avgProgress,
    },
    jobApplications: {
      total: applications.length,
      applied: appByStatus('APPLIED') + appByStatus('DRAFT'),
      interview: appByStatus('INTERVIEW'),
      offer: appByStatus('OFFER'),
    },
    salary: {
      current: profile?.currentSalary ?? null,
      goal: profile?.salaryExpectation ?? null,
      currency: profile?.salaryCurrency ?? 'USD',
      goalCurrency: profile?.salaryGoalCurrency ?? profile?.salaryCurrency ?? 'USD',
    },
    salaryTrend,
    skillGrowthTrend,
    roadmap: {
      hasRoadmap: Boolean(roadmap),
      totalResources,
      completedResources,
      progressPct,
    },
    careerReadiness,
    profileCompletion,
  };
}
