import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized, notFound } from '@/server/errors/http-error';
import { prisma } from '@/server/db/prisma';
import { runResumeParse } from '@/server/services/resume-parse-runner.service';
import { cacheService } from '@/server/cache/cache-service';
import { cacheKeys } from '@/server/cache/cache-keys';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const paramsSchema = z.object({ resumeId: z.string().min(1) });

/** Manual parse trigger / retry when async worker did not run. */
export async function POST(
  _req: Request,
  context: { params: { resumeId: string } },
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const params = paramsSchema.parse(context.params);
    const resume = await prisma.resume.findFirst({
      where: { id: params.resumeId, userId: session.user.id, deletedAt: null },
      select: { id: true, parseStatus: true },
    });
    if (!resume) throw notFound('Resume not found');

    if (resume.parseStatus === 'PROCESSING') {
      return NextResponse.json({ ok: true, data: { status: 'PROCESSING', message: 'Parse already in progress' } });
    }

    const result = await runResumeParse(resume.id);
    await cacheService.del(cacheKeys.userProfile(session.user.id), cacheKeys.profileAnalytics(session.user.id));

    return NextResponse.json({
      ok: true,
      data: {
        status: result.ok ? 'COMPLETE' : 'FAILED',
        atsScore: result.atsScore ?? null,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
