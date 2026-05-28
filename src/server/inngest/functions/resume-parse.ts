import { inngest } from '../client';
import { prisma } from '@/server/db/prisma';
import { logger } from '@/server/logger';
import { runResumeParse } from '@/server/services/resume-parse-runner.service';

export const resumeParseFn = inngest.createFunction(
  {
    id: 'resume-parse',
    name: 'Resume / Parse',
    retries: 3,
    onFailure: async ({ event, error }) => {
      const resumeId = (event.data.event?.data as { resumeId?: string } | undefined)?.resumeId;
      if (!resumeId) return;
      await prisma.resume.updateMany({
        where: { id: resumeId, deletedAt: null },
        data: { parseStatus: 'FAILED', parseError: String(error?.message ?? 'Resume parse failed') },
      });
      logger.warn('resume.parse failed', { resumeId, error: String(error?.message) });
    },
  },
  { event: 'app/resume.parse' },
  async ({ event }) => {
    const resumeId = event.data.resumeId as string;
    const result = await runResumeParse(resumeId);
    return { ok: result.ok, resumeId };
  },
);
