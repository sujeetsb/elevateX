import { Prisma, RecommendationKind } from '@prisma/client';
import { inngest } from '../client';
import { prisma, prismaInteractiveTx } from '@/server/db/prisma';
import { getRankedJobsForUser } from '@/server/services/job-recommendation.service';
import { cacheService } from '@/server/cache/cache-service';
import { PROMPT_VERSION, promptKeys, courseRecommendSystem } from '@/server/ai/prompts/registry';
import { generateJsonText } from '@/server/ai/gemini';
import { courseRecommendResultSchema } from '@/server/ai/schemas';
import { env } from '@/lib/server-env';
import { logger } from '@/server/logger';
import type { ResumeIntelligence } from '@/server/ai/schemas';

function ensureHttpUrl(u: string): string {
  const t = u.trim();
  return /^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/+/, '')}`;
}

async function generateCourseRecommendations(
  userId: string,
  profile: { targetRole?: string | null; careerGoal?: string | null; experienceYears?: string | null; preferredIndustry?: string | null },
  parsedResume: ResumeIntelligence | null,
) {
  if (!env.GEMINI_API_KEY) return null;

  try {
    const userBlob = JSON.stringify({
      targetRole: profile.targetRole,
      careerGoal: profile.careerGoal,
      experienceYears: profile.experienceYears,
      industry: profile.preferredIndustry ?? parsedResume?.industriesSuggested?.[0],
      careerLevel: parsedResume?.careerLevel,
      skills: parsedResume?.skills?.slice(0, 30) ?? [],
      gaps: parsedResume?.gaps?.slice(0, 15) ?? [],
      atsScore: parsedResume?.atsScore,
      certifications: parsedResume?.certifications?.slice(0, 8) ?? [],
      domainExpertise: parsedResume?.domainExpertise?.slice(0, 10) ?? [],
    });

    const { text } = await generateJsonText({
      system: courseRecommendSystem(),
      user: userBlob,
      quality: 'balanced',
      maxOutputTokens: 4096,
    });

    const parsed = courseRecommendResultSchema.safeParse(JSON.parse(text));
    if (!parsed.success) {
      logger.warn('course.recommend zod failed', { userId, issues: parsed.error.flatten() });
      return null;
    }

    return parsed.data.recommendations.map(r => ({
      ...r,
      url: ensureHttpUrl(r.url),
    }));
  } catch (e) {
    logger.warn('course.recommend failed', { userId, error: String(e) });
    return null;
  }
}

/** Recompute job matches + course recommendations and persist as AiRecommendation rows. */
export const recommendationsRefreshFn = inngest.createFunction(
  { id: 'recommendations-refresh', name: 'Recommendations / Jobs + Courses refresh', retries: 2 },
  { event: 'app/recommendations.refresh' },
  async ({ event, step }) => {
    const userId = event.data.userId as string;
    if (!userId) return { ok: false, reason: 'missing userId' };

    const context = await step.run('load-context', async () => {
      const [profile, resume] = await Promise.all([
        prisma.profile.findUnique({ where: { userId } }),
        prisma.resume.findFirst({
          where: { userId, deletedAt: null, parseStatus: 'COMPLETE' },
          orderBy: { updatedAt: 'desc' },
          select: { parsedJson: true },
        }),
      ]);
      return { profile, parsedResume: (resume?.parsedJson ?? null) as ResumeIntelligence | null };
    });

    const ranked = await step.run('rank-jobs', () => getRankedJobsForUser(userId));

    const courses = await step.run('recommend-courses', () =>
      generateCourseRecommendations(userId, context.profile ?? {}, context.parsedResume),
    );

    await step.run('persist', async () => {
      await prisma.$transaction(
        async tx => {
          await tx.aiRecommendation.deleteMany({
            where: { userId, promptKey: { startsWith: 'jobs.engine' } },
          });
          await tx.aiRecommendation.deleteMany({
            where: { userId, promptKey: { startsWith: 'learn.courses' } },
          });

          for (const r of ranked.slice(0, 20)) {
            await tx.aiRecommendation.create({
              data: {
                userId,
                kind: RecommendationKind.JOB,
                score: r.score,
                payload: {
                  jobId:   r.job.id,
                  reasons: r.reasons,
                  title:   r.job.title,
                  company: r.job.company,
                } as Prisma.InputJsonValue,
                rationale:  r.reasons.join('; ').slice(0, 2000),
                promptKey:  'jobs.engine.ranked',
                promptVer:  PROMPT_VERSION,
              },
            });
          }

          if (courses?.length) {
            for (const course of courses.slice(0, 12)) {
              await tx.aiRecommendation.create({
                data: {
                  userId,
                  kind: RecommendationKind.LEARNING,
                  score: course.priority === 'must-have' ? 95 : course.priority === 'high' ? 85 : course.priority === 'medium' ? 70 : 55,
                  payload: {
                    title:          course.title,
                    provider:       course.provider,
                    url:            course.url,
                    kind:           course.kind,
                    difficulty:     course.difficulty,
                    estimatedHours: course.estimatedHours,
                    skillsCovered:  course.skillsCovered,
                    type:           'ai_course_recommendation',
                  } as Prisma.InputJsonValue,
                  rationale:  (course.whyRecommended ?? `Recommended for ${context.profile?.targetRole ?? 'your career goals'}`).slice(0, 2000),
                  promptKey:  promptKeys.courseRecommend,
                  promptVer:  PROMPT_VERSION,
                },
              });
            }
          }
        },
        prismaInteractiveTx.standard,
      );
    });

    await step.run('invalidate-redis', () => cacheService.invalidateUser(userId));

    logger.info('recommendations.refresh done', { userId, jobs: ranked.length, courses: courses?.length ?? 0 });
    return { ok: true, userId, jobs: ranked.length, courses: courses?.length ?? 0 };
  },
);
