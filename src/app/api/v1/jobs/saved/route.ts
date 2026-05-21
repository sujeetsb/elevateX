import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db/prisma';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized, notFound } from '@/server/errors/http-error';
import { ActivityVerb } from '@prisma/client';
import { cacheService } from '@/server/cache/cache-service';
import { inngest } from '@/server/inngest/client';
import { enforceRateLimit } from '@/server/rate-limit/upstash-route';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  jobId: z.string().min(1),
  note: z.string().max(4000).optional(),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const saved = await prisma.savedJob.findMany({
      where: { userId: session.user.id },
      include: { job: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      ok: true,
      data: saved.map(s => ({
        jobId: s.jobId,
        title: s.job.title,
        company: s.job.company,
        location: s.job.location,
        url: s.job.url,
        salaryMin: s.job.salaryMin,
        salaryMax: s.job.salaryMax,
        savedAt: s.createdAt,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    await enforceRateLimit(`user:${session.user.id}:jobs.saved`, { limit: 30, window: '60 m' });

    const body = bodySchema.parse(await req.json());

    const job = await prisma.job.findFirst({
      where: { id: body.jobId, deletedAt: null },
      select: { id: true },
    });
    if (!job) throw notFound('Job not found');

    const userId = session.user.id;

    await prisma.$transaction(async tx => {
      await tx.savedJob.upsert({
        where: { userId_jobId: { userId, jobId: body.jobId } },
        create: { userId, jobId: body.jobId, note: body.note },
        update: { note: body.note },
      });

      await tx.activityLog.create({
        data: {
          userId,
          verb: ActivityVerb.JOB_SAVE,
          subject: body.jobId,
          metadata: body.note ? { note: body.note } : undefined,
        },
      });

      await tx.userAnalytics.upsert({
        where: { userId },
        create: { userId, jobViews: 0, jobClicks: 1 },
        update: { jobClicks: { increment: 1 } },
      });
    });

    // Keep any job-derived UI in sync.
    void cacheService.invalidateUser(userId);
    // Recompute ranked recommendations asynchronously.
    void inngest.send([{ name: 'app/recommendations.refresh', data: { userId } }]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

