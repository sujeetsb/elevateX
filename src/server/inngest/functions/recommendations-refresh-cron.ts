import { Prisma, RecommendationKind } from '@prisma/client';
import { inngest } from '../client';
import { prisma, prismaInteractiveTx } from '@/server/db/prisma';
import { getRankedJobsForUser } from '@/server/services/job-recommendation.service';
import { cacheService } from '@/server/cache/cache-service';
import { PROMPT_VERSION } from '@/server/ai/prompts/registry';
import { logger } from '@/server/logger';

/**
 * Scheduled recommendation refresh for active users.
 *
 * Cron runs every 2 hours.
 */
export const recommendationsRefreshCronFn = inngest.createFunction(
  { id: 'recommendations-refresh-cron', name: 'Recommendations / Jobs refresh (cron)', retries: 2 },
  { cron: '0 */2 * * *' },
  async ({ step }) => {
    const userIds = await step.run('load-users', () =>
      prisma.user
        .findMany({
          where: { profile: { onboardingComplete: true } },
          select: { id: true },
        })
        .then(rows => rows.map(r => r.id)),
    );

    for (const userId of userIds) {
      const ranked = await getRankedJobsForUser(userId);

      await prisma.$transaction(
        async tx => {
          await tx.aiRecommendation.deleteMany({
            where: { userId, promptKey: { startsWith: 'jobs.engine' } },
          });

          for (const r of ranked.slice(0, 20)) {
            await tx.aiRecommendation.create({
              data: {
                userId,
                kind: RecommendationKind.JOB,
                score: r.score,
                payload: {
                  jobId: r.job.id,
                  reasons: r.reasons,
                  title: r.job.title,
                  company: r.job.company,
                } as Prisma.InputJsonValue,
                rationale: r.reasons.join('; ').slice(0, 2000),
                promptKey: 'jobs.engine.ranked',
                promptVer: PROMPT_VERSION,
              },
            });
          }
        },
        prismaInteractiveTx.standard,
      );

      await cacheService.invalidateUser(userId);
      logger.info('recommendations.refresh-cron done', { userId, count: ranked.length });
    }

    return { ok: true, users: userIds.length };
  },
);

