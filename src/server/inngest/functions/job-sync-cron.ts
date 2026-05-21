import { Prisma } from '@prisma/client';
import { inngest } from '../client';
import { prisma } from '@/server/db/prisma';
import { aggregateRemoteJobs } from '@/server/jobs/aggregator';
import { logger } from '@/server/logger';

/**
 * Scheduled job sync: refresh normalized jobs periodically.
 *
 * Cron runs every hour. Event-based sync (`app/jobs.sync`) still works.
 */
export const jobSyncCronFn = inngest.createFunction(
  { id: 'job-sync-cron', name: 'Jobs / Sync providers (cron)', retries: 2 },
  { cron: '0 * * * *' },
  async ({ step }) => {
    const rows = await step.run('fetch-normalize', () => aggregateRemoteJobs());
    let upserted = 0;

    await step.run('upsert', async () => {
      for (const j of rows) {
        try {
          await prisma.job.upsert({
            where: { source_externalId: { source: j.source, externalId: j.externalId } },
            create: {
              source: j.source,
              externalId: j.externalId,
              title: j.title,
              company: j.company,
              location: j.location,
              description: j.description,
              url: j.url,
              salaryMin: j.salaryMin,
              salaryMax: j.salaryMax,
              currency: j.currency,
              postedAt: j.postedAt,
              metadata: j.metadata as Prisma.InputJsonValue,
            },
            update: {
              title: j.title,
              company: j.company,
              location: j.location,
              description: j.description,
              url: j.url,
              salaryMin: j.salaryMin,
              salaryMax: j.salaryMax,
              postedAt: j.postedAt,
              metadata: j.metadata as Prisma.InputJsonValue,
            },
          });
          upserted++;
        } catch (e) {
          logger.warn('job-sync-cron job.upsert failed', { externalId: j.externalId, error: String(e) });
        }
      }
    });

    logger.info('job-sync-cron done', { upserted, rows: rows.length });
    return { ok: true, upserted, rows: rows.length };
  },
);

