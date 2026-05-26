import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApplicationStatus } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized, notFound } from '@/server/errors/http-error';
import { cacheService } from '@/server/cache/cache-service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  applicationId: z.string().min(1),
  status: z.nativeEnum(ApplicationStatus),
});

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const body = bodySchema.parse(await req.json());
    const app = await prisma.jobApplication.findFirst({
      where: { id: body.applicationId, userId: session.user.id, deletedAt: null },
    });
    if (!app) throw notFound('Application not found');

    const updated = await prisma.jobApplication.update({
      where: { id: app.id },
      data: {
        status: body.status,
        appliedAt: body.status === ApplicationStatus.APPLIED && !app.appliedAt ? new Date() : app.appliedAt,
      },
      include: { job: true },
    });

    await cacheService.invalidateUser(session.user.id);

    return NextResponse.json({
      ok: true,
      data: {
        applicationId: updated.id,
        jobId: updated.jobId,
        status: updated.status,
        appliedAt: updated.appliedAt,
        job: {
          id: updated.job.id,
          title: updated.job.title,
          company: updated.job.company,
        },
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
