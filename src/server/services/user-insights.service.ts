import { Prisma, RecommendationKind, RoadmapStatus } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { generateJsonText } from '@/server/ai/gemini';
import { env } from '@/lib/server-env';
import { logger } from '@/server/logger';
import { mapResumeParsedJsonToOnboardingPrefill } from '@/lib/onboarding/map-resume-parsed-json';
import { resolveSalaryLocale } from '@/lib/salary/locale';
import { generateAndPersistCourse } from '@/server/services/course-generation.service';
import { enrollUserInCourse } from '@/server/services/course.service';
import {
  computeProfileSourceHash,
  hasSalaryInsightsPayload,
  isInsightsFresh,
} from '@/server/services/profile-version.service';
import type { ResumeIntelligence } from '@/server/ai/schemas';

export type UserInsightsPayload = {
  careerGoals: string[];
  targetRoles: string[];
  recommendedCourses: Array<{
    title: string;
    difficulty: string;
    days: number;
    tags: string[];
    reason: string;
    courseId?: string;
  }>;
  salaryInsights: Record<string, unknown>;
  skillsGap: Array<{ skill: string; priority: string; reason?: string }>;
  careerPath: {
    title?: string;
    subtitle?: string;
    weeks?: number;
    stages?: Array<{ title: string; summary?: string; timeframeWeeks?: number }>;
    modules?: Array<{ title: string; summary?: string; lessons?: string[]; durationWeeks?: number }>;
    milestones?: string[];
    certifications?: Array<{ title: string; issuer?: string }>;
  };
  industry?: string;
};

function fallbackInsights(ctx: {
  currentRole: string;
  targetRole: string;
  skills: string[];
  industry: string;
  education: string;
  experience: string;
  currentSalary: string;
  salaryExpectation: string;
  salaryCurrency: string;
  salaryFrequency: string;
  salaryGoalCurrency: string;
  salaryGoalFrequency: string;
  country: string;
  locationPreference: string;
}): UserInsightsPayload {
  const target = ctx.targetRole || 'Senior Professional';
  const salaryUnit = ctx.salaryFrequency || 'Annual';
  const goalUnit = ctx.salaryGoalFrequency || ctx.salaryFrequency || 'Annual';
  const goalCurrency = ctx.salaryGoalCurrency || ctx.salaryCurrency || 'USD';
  const location = ctx.locationPreference || ctx.country || 'your market';
  return {
    careerGoals: [
      `Advance from ${ctx.currentRole || 'current role'} toward ${target} within 2–3 years`,
      `Build expertise in ${ctx.skills.slice(0, 3).join(', ') || 'core domain skills'} aligned with ${ctx.industry || 'your industry'}`,
      `Demonstrate measurable impact and leadership readiness for ${target}`,
    ],
    targetRoles: [target, `Senior ${ctx.currentRole || 'Professional'}`, `Lead ${ctx.currentRole || 'Professional'}`].filter(Boolean),
    recommendedCourses: [
      {
        title: `${target} Essentials`,
        difficulty: 'Intermediate',
        days: 14,
        tags: ctx.skills.slice(0, 3),
        reason: `Close skill gaps for your target role in ${ctx.industry || 'your field'}`,
      },
      {
        title: `${ctx.industry || 'Industry'} Leadership Skills`,
        difficulty: 'Advanced',
        days: 21,
        tags: ['Leadership', 'Communication'],
        reason: 'Prepare for senior-level responsibilities',
      },
    ],
    salaryInsights: {
      currentEstimate: ctx.currentSalary
        ? `${ctx.currentSalary} (${ctx.salaryCurrency || 'USD'} ${salaryUnit})`
        : undefined,
      roleAverage: `Market average for ${ctx.currentRole || 'your role'} in ${location}`,
      futureRoleSalary: ctx.salaryExpectation
        ? `${ctx.salaryExpectation} (${goalCurrency} ${goalUnit})`
        : `Higher band for ${target}`,
      fiveYearProjection: 'Projected progression based on your current role and growth path.',
      industryBenchmark: `Benchmarked for ${ctx.industry || 'your industry'} roles in ${location}`,
      locationComparison: `${location} compensation comparison`,
    },
    skillsGap: ctx.skills.slice(0, 5).map((s, i) => ({
      skill: s,
      priority: i < 2 ? 'high' : 'medium',
      reason: 'Identified from your resume profile',
    })),
    careerPath: {
      title: `Path to ${target}`,
      subtitle: `Personalized plan based on your ${ctx.experience || 'experience'}`,
      weeks: 12,
      stages: [
        { title: 'Foundation', summary: 'Align resume and core competencies', timeframeWeeks: 3 },
        { title: 'Skill depth', summary: 'Close priority gaps with practice', timeframeWeeks: 6 },
        { title: 'Career launch', summary: 'Apply and interview for target roles', timeframeWeeks: 3 },
      ],
      modules: [
        { title: 'Role alignment', summary: 'Resume, LinkedIn, and positioning', lessons: ['Profile audit', 'Keyword optimization'], durationWeeks: 2 },
        { title: 'Core skills', summary: 'Targeted upskilling', lessons: ctx.skills.slice(0, 4), durationWeeks: 4 },
        { title: 'Career transition', summary: 'Applications and interviews', lessons: ['Job search strategy', 'Interview prep'], durationWeeks: 2 },
      ],
      milestones: ['Resume optimized for target role', 'Completed skill-gap course', 'First interview secured'],
      certifications: [{ title: 'Industry fundamentals', issuer: 'Recommended provider' }],
    },
    industry: ctx.industry,
  };
}

export async function getUserInsights(userId: string) {
  return prisma.userInsights.findUnique({ where: { userId } });
}

async function buildInsightContext(userId: string) {
  const [profile, skills, resume] = await Promise.all([
    prisma.profile.findUnique({ where: { userId } }),
    prisma.userSkill.findMany({ where: { userId }, include: { skill: true } }),
    prisma.resume.findFirst({
      where: { userId, deletedAt: null, parseStatus: 'COMPLETE' },
      orderBy: { updatedAt: 'desc' },
    }),
  ]);

  const parsed = (resume?.parsedJson ?? null) as ResumeIntelligence | Record<string, unknown> | null;
  const prefill = parsed ? mapResumeParsedJsonToOnboardingPrefill(parsed) : {};

  const currentRole = profile?.currentRole ?? prefill.currentRole ?? '';
  const targetRole = profile?.targetRole ?? prefill.targetRole ?? '';
  const skillLabels = skills.map(s => s.skill.label);
  const allSkills = [...new Set([...skillLabels, ...(prefill.skills ?? [])])];
  const industry = profile?.preferredIndustry ?? (parsed as ResumeIntelligence)?.industriesSuggested?.[0] ?? '';
  const education = profile?.education ?? prefill.education ?? '';
  const experience = profile?.experienceYears ?? prefill.experience ?? '';
  const currentSalary = profile?.currentSalary ?? '';
  const salaryExpectation = profile?.salaryExpectation ?? '';
  const salaryCurrency = profile?.salaryCurrency ?? '';
  const salaryFrequency = profile?.salaryFrequency ?? '';
  const salaryGoalCurrency = profile?.salaryGoalCurrency ?? salaryCurrency;
  const salaryGoalFrequency = profile?.salaryGoalFrequency ?? salaryFrequency;
  const country = profile?.country ?? '';
  const locationPreference = profile?.locationPreference ?? '';

  const sourceHash = computeProfileSourceHash({
    resumeId: resume?.id,
    resumeContentHash: resume?.contentHash,
    currentRole,
    targetRole,
    experienceYears: experience,
    careerGoal: profile?.careerGoal ?? prefill.careerGoal,
    education,
    industry,
    country: profile?.country,
    locationPreference: profile?.locationPreference,
    currentSalary: profile?.currentSalary,
    salaryExpectation: profile?.salaryExpectation,
    salaryGoalCurrency: profile?.salaryGoalCurrency,
    salaryGoalFrequency: profile?.salaryGoalFrequency,
    salaryCurrency: profile?.salaryCurrency,
    salaryFrequency: profile?.salaryFrequency,
    compensationType: profile?.compensationType,
    skills: allSkills,
  });

  return {
    profile,
    resume,
    parsed,
    prefill,
    currentRole,
    targetRole,
    allSkills,
    industry,
    education,
    experience,
    currentSalary,
    salaryExpectation,
    salaryCurrency,
    salaryFrequency,
    salaryGoalCurrency,
    salaryGoalFrequency,
    country,
    locationPreference,
    sourceHash,
  };
}

/** Return cached insights when profileVersion/sourceHash still matches; else null. */
export async function getFreshUserInsights(userId: string) {
  const ctx = await buildInsightContext(userId);
  const existing = await prisma.userInsights.findUnique({ where: { userId } });
  if (!isInsightsFresh(existing, ctx.profile, ctx.sourceHash)) return null;
  return existing;
}

export async function generateUserInsights(userId: string, opts?: { force?: boolean }) {
  const ctx = await buildInsightContext(userId);
  const {
    profile,
    resume,
    prefill,
    currentRole,
    targetRole,
    allSkills,
    industry,
    education,
    experience,
    currentSalary,
    salaryExpectation,
    salaryCurrency,
    salaryFrequency,
    salaryGoalCurrency,
    salaryGoalFrequency,
    country,
    locationPreference,
    sourceHash,
  } = ctx;

  if (!opts?.force) {
    const existing = await prisma.userInsights.findUnique({ where: { userId } });
    if (isInsightsFresh(existing, profile, sourceHash)) return existing;
  }

  const locale = resolveSalaryLocale(profile ?? {});
  let payload: UserInsightsPayload;

  if (env.GEMINI_API_KEY) {
    try {
      const { text } = await generateJsonText({
        quality: 'balanced',
        system: 'You are a career intelligence engine. Respond with valid JSON only. Tailor everything to the user industry and role — do NOT suggest software engineering paths for non-tech professionals.',
        user: [
          `Current role: ${currentRole || 'Unknown'}`,
          `Target role: ${targetRole || 'Unknown'}`,
          `Industry: ${industry || 'General'}`,
          `Experience: ${experience}`,
          `Education: ${education.slice(0, 300)}`,
          `Skills: ${allSkills.join(', ') || 'None listed'}`,
          `Career objective from resume: ${prefill.careerGoal ?? profile?.careerGoal ?? 'Not specified'}`,
          `Salary currency: ${locale.currency}`,
          `Current salary: ${currentSalary || 'Unknown'}`,
          `Salary expectation: ${salaryExpectation || 'Unknown'}`,
          `Salary frequency: ${salaryFrequency || locale.salaryType}`,
          `Country/location: ${country || locationPreference || locale.country}`,
          '',
          'Return JSON:',
          '{',
          '  "careerGoals": ["3 specific goals derived from resume, skills, experience, education, target role"],',
          '  "targetRoles": ["2-4 realistic target roles"],',
          '  "recommendedCourses": [{ "title": "...", "difficulty": "Beginner|Intermediate|Advanced", "days": 14, "tags": ["..."], "reason": "..." }],',
          '  "salaryInsights": { "currentEstimate": "...", "roleAverage": "...", "futureRoleSalary": "...", "fiveYearProjection": "...", "industryBenchmark": "...", "locationComparison": "..." },',
          '  "skillsGap": [{ "skill": "...", "priority": "high|medium|low", "reason": "..." }],',
          '  "careerPath": {',
          '    "title": "...", "subtitle": "...", "weeks": 12,',
          '    "stages": [{ "title": "...", "summary": "...", "timeframeWeeks": 4 }],',
          '    "modules": [{ "title": "...", "summary": "...", "lessons": ["..."], "durationWeeks": 2 }],',
          '    "milestones": ["..."],',
          '    "certifications": [{ "title": "...", "issuer": "..." }]',
          '  },',
          '  "industry": "..."',
          '}',
        ].join('\n'),
        maxOutputTokens: 2500,
      });
      const raw = JSON.parse(text) as Partial<UserInsightsPayload>;
      payload = {
        ...fallbackInsights({
          currentRole,
          targetRole,
          skills: allSkills,
          industry,
          education,
          experience,
          currentSalary,
          salaryExpectation,
          salaryCurrency: salaryCurrency || locale.currency,
          salaryFrequency: salaryFrequency || locale.salaryType,
          salaryGoalCurrency: salaryGoalCurrency || locale.currency,
          salaryGoalFrequency: salaryGoalFrequency || locale.salaryType,
          country,
          locationPreference,
        }),
        ...raw,
        careerGoals: Array.isArray(raw.careerGoals) && raw.careerGoals.length ? raw.careerGoals : fallbackInsights({
          currentRole,
          targetRole,
          skills: allSkills,
          industry,
          education,
          experience,
          currentSalary,
          salaryExpectation,
          salaryCurrency: salaryCurrency || locale.currency,
          salaryFrequency: salaryFrequency || locale.salaryType,
          salaryGoalCurrency: salaryGoalCurrency || locale.currency,
          salaryGoalFrequency: salaryGoalFrequency || locale.salaryType,
          country,
          locationPreference,
        }).careerGoals,
        targetRoles: Array.isArray(raw.targetRoles) && raw.targetRoles.length ? raw.targetRoles : [targetRole].filter(Boolean),
        recommendedCourses: Array.isArray(raw.recommendedCourses) ? raw.recommendedCourses : [],
        skillsGap: Array.isArray(raw.skillsGap) ? raw.skillsGap : [],
        careerPath: raw.careerPath && typeof raw.careerPath === 'object' ? raw.careerPath : fallbackInsights({
          currentRole,
          targetRole,
          skills: allSkills,
          industry,
          education,
          experience,
          currentSalary,
          salaryExpectation,
          salaryCurrency: salaryCurrency || locale.currency,
          salaryFrequency: salaryFrequency || locale.salaryType,
          salaryGoalCurrency: salaryGoalCurrency || locale.currency,
          salaryGoalFrequency: salaryGoalFrequency || locale.salaryType,
          country,
          locationPreference,
        }).careerPath,
      };
    } catch (e) {
      logger.warn('user-insights AI failed, using fallback', { userId, error: String(e) });
      payload = fallbackInsights({
        currentRole,
        targetRole,
        skills: allSkills,
        industry,
        education,
        experience,
        currentSalary,
        salaryExpectation,
        salaryCurrency: salaryCurrency || locale.currency,
        salaryFrequency: salaryFrequency || locale.salaryType,
        salaryGoalCurrency: salaryGoalCurrency || locale.currency,
        salaryGoalFrequency: salaryGoalFrequency || locale.salaryType,
        country,
        locationPreference,
      });
    }
  } else {
    payload = fallbackInsights({
      currentRole,
      targetRole,
      skills: allSkills,
      industry,
      education,
      experience,
      currentSalary,
      salaryExpectation,
      salaryCurrency: salaryCurrency || locale.currency,
      salaryFrequency: salaryFrequency || locale.salaryType,
      salaryGoalCurrency: salaryGoalCurrency || locale.currency,
      salaryGoalFrequency: salaryGoalFrequency || locale.salaryType,
      country,
      locationPreference,
    });
  }

  const insights = await prisma.userInsights.upsert({
    where: { userId },
    create: {
      userId,
      resumeId: resume?.id ?? null,
      sourceHash,
      profileVersion: profile?.profileVersion ?? 0,
      careerGoals: payload.careerGoals as Prisma.InputJsonValue,
      targetRoles: payload.targetRoles as Prisma.InputJsonValue,
      recommendedCourses: payload.recommendedCourses as Prisma.InputJsonValue,
      salaryInsights: payload.salaryInsights as Prisma.InputJsonValue,
      skillsGap: payload.skillsGap as Prisma.InputJsonValue,
      careerPath: payload.careerPath as Prisma.InputJsonValue,
      industry: payload.industry ?? industry ?? null,
    },
    update: {
      resumeId: resume?.id ?? null,
      sourceHash,
      profileVersion: profile?.profileVersion ?? 0,
      careerGoals: payload.careerGoals as Prisma.InputJsonValue,
      targetRoles: payload.targetRoles as Prisma.InputJsonValue,
      recommendedCourses: payload.recommendedCourses as Prisma.InputJsonValue,
      salaryInsights: payload.salaryInsights as Prisma.InputJsonValue,
      skillsGap: payload.skillsGap as Prisma.InputJsonValue,
      careerPath: payload.careerPath as Prisma.InputJsonValue,
      industry: payload.industry ?? industry ?? null,
      updatedAt: new Date(),
    },
  });

  // Sync profile career goal if empty
  if (!profile?.careerGoal?.trim() && payload.careerGoals[0]) {
    await prisma.profile.update({
      where: { userId },
      data: {
        careerGoal: payload.careerGoals[0],
        ...(!profile?.targetRole?.trim() && payload.targetRoles[0] ? { targetRole: payload.targetRoles[0] } : {}),
      },
    }).catch(() => undefined);
  }

  // Persist roadmap from careerPath
  const path = payload.careerPath;
  if (path?.modules?.length || path?.stages?.length) {
    await prisma.learningRoadmap.updateMany({
      where: { userId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    await prisma.learningRoadmap.create({
      data: {
        userId,
        title: path.title ?? `Career roadmap: ${targetRole || currentRole || 'Growth'}`,
        summary: path.subtitle ?? null,
        targetRole: targetRole || payload.targetRoles[0] || null,
        status: RoadmapStatus.ACTIVE,
        jsonPlan: {
          title: path.title,
          subtitle: path.subtitle,
          weeks: path.weeks,
          stages: path.stages,
          modules: path.modules,
          milestones: path.milestones,
          certifications: path.certifications,
        } as Prisma.InputJsonValue,
      },
    });
  }

  // Persist course recommendations
  await prisma.aiRecommendation.deleteMany({
    where: { userId, kind: RecommendationKind.LEARNING, promptKey: 'user.insights.courses' },
  });
  for (const rec of payload.recommendedCourses.slice(0, 8)) {
    await prisma.aiRecommendation.create({
      data: {
        userId,
        kind: RecommendationKind.LEARNING,
        score: 85,
        promptKey: 'user.insights.courses',
        promptVer: '1',
        payload: rec as Prisma.InputJsonValue,
        rationale: rec.reason?.slice(0, 500) ?? rec.title,
      },
    });
  }

  // Auto-generate first recommended course + enroll
  const firstRec = payload.recommendedCourses[0];
  if (firstRec?.title) {
    try {
      const { course } = await generateAndPersistCourse({
        userId,
        title: firstRec.title,
        goals: firstRec.tags ?? [],
        skillLevel: firstRec.difficulty ?? 'Intermediate',
        durationDays: firstRec.days ?? 14,
      });
      await enrollUserInCourse(userId, course.id);
      firstRec.courseId = course.id;
      await prisma.userInsights.update({
        where: { userId },
        data: { recommendedCourses: payload.recommendedCourses as Prisma.InputJsonValue },
      });
    } catch (e) {
      logger.warn('user-insights auto-course failed', { userId, error: String(e) });
    }
  }

  return insights;
}

export { hasSalaryInsightsPayload };
