import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ActivityVerb, ApplicationStatus } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized, notFound, badRequest } from '@/server/errors/http-error';
import { cacheService } from '@/server/cache/cache-service';
import { inngest } from '@/server/inngest/client';
import { enforceRateLimit } from '@/server/rate-limit/upstash-route';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  jobId: z.string().min(1),
  status: z.nativeEnum(ApplicationStatus).optional(),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const applications = await prisma.jobApplication.findMany({
      where: { userId: session.user.id, deletedAt: null },
      include: { job: true },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      ok: true,
      data: applications.map(a => ({
        applicationId: a.id,
        jobId: a.jobId,
        status: a.status,
        appliedAt: a.appliedAt,
        matchScore: a.matchScore,
        job: {
          id: a.job.id,
          title: a.job.title,
          company: a.job.company,
          location: a.job.location,
          url: a.job.url,
          salaryMin: a.job.salaryMin,
          salaryMax: a.job.salaryMax,
        },
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

    await enforceRateLimit(`user:${session.user.id}:jobs.applications`, { limit: 30, window: '60 m' });

    const body = bodySchema.parse(await req.json());
    const status = body.status ?? ApplicationStatus.APPLIED;

    const job = await prisma.job.findFirst({
      where: { id: body.jobId, deletedAt: null },
      select: { id: true },
    });
    if (!job) throw notFound('Job not found');

    const userId = session.user.id;

    await prisma.$transaction(async tx => {
      // Ensure a single active application per user+job by updating the latest non-deleted row.
      const existing = await tx.jobApplication.findFirst({
        where: { userId, jobId: body.jobId, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });

      if (existing) {
        await tx.jobApplication.update({
          where: { id: existing.id },
          data: {
            status,
            appliedAt: status === ApplicationStatus.APPLIED ? existing.appliedAt ?? new Date() : existing.appliedAt,
          },
        });
      } else {
        await tx.jobApplication.create({
          data: {
            userId,
            jobId: body.jobId,
            status,
            appliedAt: status === ApplicationStatus.APPLIED ? new Date() : undefined,
          },
        });
      }

      await tx.activityLog.create({
        data: {
          userId,
          verb: ActivityVerb.JOB_APPLY,
          subject: body.jobId,
          metadata: { status },
        },
      });

      await tx.userAnalytics.upsert({
        where: { userId },
        create: { userId, jobViews: 0, jobClicks: 1 },
        update: { jobClicks: { increment: 1 } },
      });
    });

    void cacheService.invalidateUser(userId);
    // Recompute ranked recommendations asynchronously.
    void inngest.send([{ name: 'app/recommendations.refresh', data: { userId } }]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

