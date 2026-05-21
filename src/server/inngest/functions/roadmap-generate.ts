import { Prisma, ActivityVerb, RoadmapStatus } from '@prisma/client';
import { inngest } from '../client';
import { prisma, prismaInteractiveTx } from '@/server/db/prisma';
import { env } from '@/lib/server-env';
import { generateJsonText } from '@/server/ai/gemini';
import { learningRoadmapResultSchema, type ResumeIntelligence } from '@/server/ai/schemas';
import { learningRoadmapSystem, promptKeys, PROMPT_VERSION } from '@/server/ai/prompts/registry';
import { cacheService } from '@/server/cache/cache-service';
import { logger } from '@/server/logger';

function ensureHttpUrl(u: string): string {
  const t = u.trim();
  if (/^https?:\/\//i.test(t)) return t;
  return `https://${t.replace(/^\/+/, '')}`;
}

function fallbackRoadmap(targetRole: string, gaps: string[]) {
  const g = gaps.filter(Boolean).slice(0, 4);
  const titles = g.length ? g : ['Role fundamentals', 'Core workflows', 'Communication & influence', 'Measurable outcomes'];
  return learningRoadmapResultSchema.parse({
    title: `Career roadmap: ${targetRole}`,
    subtitle: 'Balanced plan mixing foundations, credibility, and role-specific depth.',
    weeks: 8,
    audience: 'General professional',
    stages: [
      { title: 'Foundations', summary: 'Clarify expectations and vocabulary for your target path.', timeframeWeeks: 2 },
      { title: 'Skill depth', summary: 'Close priority gaps with practice and feedback.', timeframeWeeks: 4 },
      { title: 'Credibility', summary: 'Projects, storytelling, and artifacts recruiters recognize.', timeframeWeeks: 2 },
    ],
    milestones: [
      'Updated resume and LinkedIn aligned to target role',
      'One portfolio or case-study artifact completed',
      'Mock interview or stakeholder review completed',
    ],
    certifications: [
      { title: 'Industry-recognized fundamentals course', issuer: 'Open learning provider' },
    ],
    projectIdeas: [
      `Deliver a small end-to-end initiative relevant to ${targetRole}`,
      'Document metrics before/after for one real or simulated workflow',
    ],
    industryNotes:
      'Tune every milestone to your industry: emphasize compliance and stakeholder clarity in regulated fields; emphasize pipeline and narrative in GTM roles.',
    modules: titles.map(title => ({
      title,
      summary: `Build practical strength in: ${title}`,
      resources: [
        {
          title: 'Skills and career guides',
          url: 'https://www.coursera.org/',
          provider: 'Coursera',
          kind: 'course',
        },
        {
          title: 'Professional learning hub',
          url: 'https://www.linkedin.com/learning/',
          provider: 'LinkedIn Learning',
          kind: 'course',
        },
      ],
    })),
  });
}

export const roadmapGenerateFn = inngest.createFunction(
  { id: 'roadmap-generate', name: 'Learning / Roadmap generate', retries: 2 },
  { event: 'app/roadmap.generate' },
  async ({ event, step }) => {
    const userId = event.data.userId as string;
    if (!userId) return { ok: false, reason: 'missing userId' };

    const context = await step.run('load-context', async () => {
      const [profile, skills, resume] = await Promise.all([
        prisma.profile.findUnique({ where: { userId } }),
        prisma.userSkill.findMany({ where: { userId }, include: { skill: true } }),
        prisma.resume.findFirst({
          where: { userId, deletedAt: null, parseStatus: 'COMPLETE' },
          orderBy: { updatedAt: 'desc' },
        }),
      ]);
      const parsed = resume?.parsedJson as ResumeIntelligence | null;
      const skillLabels = skills.map(s => s.skill.label);
      const gaps = parsed?.gaps?.length ? parsed.gaps : ['Storytelling impact', 'Stakeholder communication', 'Metrics literacy'];
      const target = profile?.targetRole ?? parsed?.targetRolesSuggested?.[0] ?? 'Professional';
      const industries = parsed?.industriesSuggested?.length ? parsed.industriesSuggested : [];
      const educationLines =
        parsed?.education
          ?.map(e =>
            [e.institution ?? e.school, e.degree, e.specialization].filter(Boolean).join(' — '),
          )
          .filter(Boolean) ?? [];
      const experienceTitles =
        parsed?.experience?.map(e => e.title ?? e.role).filter((t): t is string => Boolean(t?.trim())) ?? [];
      return {
        profile,
        skillLabels,
        gaps,
        target,
        summary: parsed?.summary,
        headline: parsed?.headline,
        careerObjective: parsed?.careerObjective ?? profile?.careerGoal,
        educationLines,
        experienceTitles,
        industries,
        careerLevel: parsed?.careerLevel,
        certifications: parsed?.certifications?.slice(0, 12) ?? [],
        preferredIndustry: profile?.preferredIndustry,
      };
    });

    const userBlob = JSON.stringify({
      targetRole: context.target,
      preferredIndustry: context.preferredIndustry,
      careerGoal: context.profile?.careerGoal,
      experienceYears: context.profile?.experienceYears,
      education: context.educationLines,
      experienceTitles: context.experienceTitles,
      industriesSuggested: context.industries,
      careerLevel: context.careerLevel,
      headline: context.headline,
      careerObjective: context.careerObjective,
      skills: context.skillLabels,
      certifications: context.certifications,
      gaps: context.gaps,
      summary: context.summary,
    });

    const plan = await step.run('gemini-roadmap', async () => {
      if (!env.GEMINI_API_KEY) {
        return fallbackRoadmap(context.target, context.gaps);
      }
      try {
        const { text } = await generateJsonText({
          system: learningRoadmapSystem(),
          user: userBlob.slice(0, 16_000),
          maxOutputTokens: 8192,
        });
        const json = JSON.parse(text) as unknown;
        const parsed = learningRoadmapResultSchema.safeParse(json);
        if (parsed.success && parsed.data.modules?.length) {
          const normalized = {
            ...parsed.data,
            modules: parsed.data.modules.map(m => ({
              ...m,
              resources: m.resources.map(r => ({
                ...r,
                url: ensureHttpUrl(r.url),
              })),
            })),
            certifications: (parsed.data.certifications ?? []).map(c => ({
              ...c,
              url: c.url ? ensureHttpUrl(c.url) : undefined,
            })),
          };
          return learningRoadmapResultSchema.parse(normalized);
        }
        logger.warn('roadmap zod failed', { userId, issues: parsed.success ? [] : parsed.error.flatten() });
      } catch (e) {
        logger.warn('roadmap gemini failed', { userId, error: String(e) });
      }
      return fallbackRoadmap(context.target, context.gaps);
    });

    await step.run('persist-roadmap', async () => {
      await prisma.$transaction(
        async tx => {
          await tx.learningRoadmap.updateMany({
            where: { userId, status: RoadmapStatus.ACTIVE, deletedAt: null },
            data: { status: RoadmapStatus.ARCHIVED },
          });

          await tx.learningRoadmap.create({
            data: {
              userId,
              title: plan.title,
              summary: [plan.subtitle, plan.weeks != null ? `~${plan.weeks} weeks` : null].filter(Boolean).join(' · ') || `~${plan.weeks ?? 4} weeks`,
              jsonPlan: plan as Prisma.InputJsonValue,
              status: RoadmapStatus.ACTIVE,
              targetRole: context.target,
            },
          });

          await tx.activityLog.create({
            data: {
              userId,
              verb: ActivityVerb.ROADMAP_GENERATED,
              metadata: { title: plan.title } as Prisma.InputJsonValue,
            },
          });

          await tx.cachedAiResponse.upsert({
            where: { cacheKey: `roadmap:${userId}:latest` },
            create: {
              cacheKey: `roadmap:${userId}:latest`,
              promptKey: promptKeys.learningRoadmap,
              promptVer: PROMPT_VERSION,
              model: 'gemini',
              response: plan as Prisma.InputJsonValue,
              expiresAt: new Date(Date.now() + 30 * 864e5),
              userId,
            },
            update: {
              response: plan as Prisma.InputJsonValue,
              promptVer: PROMPT_VERSION,
              expiresAt: new Date(Date.now() + 30 * 864e5),
            },
          });
        },
        prismaInteractiveTx.standard,
      );
    });

    await step.run('invalidate', () => cacheService.invalidateUser(userId));
    return { ok: true, userId };
  },
);
