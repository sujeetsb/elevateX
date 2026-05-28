import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized, notFound, badRequest } from '@/server/errors/http-error';
import { enforceRateLimit } from '@/server/rate-limit/upstash-route';
import { spendGamificationXp } from '@/server/gamification/gamification.service';
import { getXpCost } from '@/lib/gamification/xp-costs';
import { optimizeResumeInStudio } from '@/server/services/resume-studio-optimize.service';
import { cacheService } from '@/server/cache/cache-service';
import { cacheKeys } from '@/server/cache/cache-keys';
import { ActivityVerb } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import type { ResumeDocument } from '@/lib/resume/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 90;

const paramsSchema = z.object({ resumeId: z.string().min(1) });

const bodySchema = z.object({
  mode: z.enum(['polish', 'rewrite', 'generate']),
  document: z.record(z.unknown()),
  targetRole: z.string().max(200).optional(),
});

export async function POST(
  req: Request,
  context: { params: { resumeId: string } },
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const params = paramsSchema.parse(context.params);
    const body = bodySchema.parse(await req.json());

    const exists = await prisma.resume.findFirst({
      where: { id: params.resumeId, userId: session.user.id, deletedAt: null },
      select: { id: true },
    });
    if (!exists) throw notFound('Resume not found');

    await enforceRateLimit(`user:${session.user.id}:studio-optimize`, { limit: 12, window: '60 m' });

    const xpCost = getXpCost('RESUME_OPTIMIZE');
    await spendGamificationXp({
      userId: session.user.id,
      amount: xpCost,
      actionKey: `studio-optimize:${params.resumeId}:${new Date().toISOString().slice(0, 10)}`,
      actionType: 'RESUME_OPTIMIZE',
    });

    const result = await optimizeResumeInStudio({
      userId: session.user.id,
      resumeId: params.resumeId,
      mode: body.mode,
      document: body.document as unknown as ResumeDocument,
      targetRole: body.targetRole,
    });

    await cacheService.del(cacheKeys.userProfile(session.user.id));

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        verb: ActivityVerb.RESUME_PARSE,
        subject: params.resumeId,
        metadata: { atsScore: result.atsScoreAfter, source: 'studio-optimize' },
      },
    });

    return NextResponse.json({ ok: true, data: result });
  } catch (e) {
    if (e instanceof z.ZodError) throw badRequest('Invalid studio optimize payload');
    return handleApiError(e);
  }
}
