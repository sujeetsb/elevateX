import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { z } from 'zod';
import { ActivityVerb } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized, notFound } from '@/server/errors/http-error';
import { cacheService } from '@/server/cache/cache-service';
import { inngest } from '@/server/inngest/client';
import { enforceRateLimit } from '@/server/rate-limit/upstash-route';
import { awardGamificationXp } from '@/server/gamification/gamification.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  resourceId: z.string().min(1),
});

function sha256Hex(s: string): string {
  return crypto.createHash('sha256').update(s, 'utf8').digest('hex');
}

type JsonPlanShape = {
  modules?: Array<{
    title: string;
    resources?: Array<{
      title: string;
      url: string;
      provider: string;
    }>;
  }>;
};

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    await enforceRateLimit(`user:${session.user.id}:learning.progress.complete`, { limit: 120, window: '60 m' });

    const body = bodySchema.parse(await req.json());
    const userId = session.user.id;

    const roadmap = await prisma.learningRoadmap.findFirst({
      where: { userId, status: 'ACTIVE', deletedAt: null },
      select: { id: true, jsonPlan: true },
    });

    if (!roadmap) throw notFound('Active learning roadmap not found');

    const jsonPlan = roadmap.jsonPlan as JsonPlanShape | null;
    const modules = jsonPlan?.modules ?? [];
    const flattened = modules.flatMap(m =>
      (m.resources ?? []).map(r => ({
        resourceId: sha256Hex(`${r.provider}|${r.url}|${r.title}`),
        title: r.title,
        url: r.url,
        provider: r.provider,
      })),
    );

    const match = flattened.find(r => r.resourceId === body.resourceId);
    if (!match) throw notFound('Resource not found in active roadmap');

    await prisma.$transaction(async tx => {
      const progress = await tx.learningProgress.findFirst({
        where: { userId, resourceId: body.resourceId },
        select: { id: true },
      });

      if (progress) {
        await tx.learningProgress.update({
          where: { id: progress.id },
          data: { completed: true, progressPct: 100 },
        });
      } else {
        await tx.learningProgress.create({
          data: {
            userId,
            roadmapId: roadmap.id,
            resourceId: body.resourceId,
            resourceUrl: match.url,
            title: match.title,
            provider: match.provider,
            completed: true,
            progressPct: 100,
            metadata: { completedAt: new Date().toISOString() },
          },
        });
      }

      await tx.userAnalytics.upsert({
        where: { userId },
        create: { userId, learningMinutes: 10 },
        update: { learningMinutes: { increment: 10 } },
      });

      await tx.activityLog.create({
        data: {
          userId,
          verb: ActivityVerb.ROADMAP_GENERATED,
          subject: body.resourceId,
          metadata: { action: 'learning.progress.complete' },
        },
      });
    });

    await cacheService.invalidateUser(userId);
    await awardGamificationXp({ userId, amount: 25 });
    const { recomputeWeeklyStudyHours } = await import('@/server/services/weekly-study-hours.service');
    await recomputeWeeklyStudyHours(userId);
    // Refresh job recommendations after learning progress changes.
    void inngest.send([{ name: 'app/recommendations.refresh', data: { userId } }]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}

