import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db/prisma';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized, notFound } from '@/server/errors/http-error';
import { inngest } from '@/server/inngest/client';
import { awardGamificationXp } from '@/server/gamification/gamification.service';
import { enforceRateLimit } from '@/server/rate-limit/upstash-route';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  courseTitle: z.string().min(1).max(200).optional(),
  resourceId: z.string().min(1).max(128).optional(),
});

/** Start or continue a course — ensures active roadmap and awards streak XP. */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();
    await enforceRateLimit(`user:${session.user.id}:learning.start`, { limit: 20, window: '60 m' });

    const body = bodySchema.parse(await req.json().catch(() => ({})));

    let roadmap = await prisma.learningRoadmap.findFirst({
      where: { userId: session.user.id, status: 'ACTIVE', deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });

    if (!roadmap) {
      await inngest.send({ name: 'app/roadmap.generate', data: { userId: session.user.id } });
      return NextResponse.json({
        ok: true,
        data: { status: 'GENERATING', message: 'AI is building your learning roadmap…' },
      });
    }

    if (body.resourceId) {
      const existing = await prisma.learningProgress.findFirst({
        where: { userId: session.user.id, resourceId: body.resourceId },
      });
      if (!existing) {
        await prisma.learningProgress.create({
          data: {
            userId: session.user.id,
            roadmapId: roadmap.id,
            resourceId: body.resourceId,
            resourceUrl: `#course-${body.resourceId}`,
            title: body.courseTitle ?? 'Course module',
            provider: 'ElevateX',
            progressPct: 0,
            completed: false,
          },
        });
      }
    }

    await awardGamificationXp({ userId: session.user.id, amount: 15 });

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        verb: 'ROADMAP_GENERATED',
        subject: body.courseTitle ?? 'course-start',
        metadata: { resourceId: body.resourceId ?? null, action: 'course_start' },
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        status: 'ACTIVE',
        roadmapId: roadmap.id,
        message: 'Course started. Progress will sync to your roadmap.',
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const roadmap = await prisma.learningRoadmap.findFirst({
      where: { userId: session.user.id, status: 'ACTIVE', deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });
    if (!roadmap) throw notFound('No active roadmap');

    return NextResponse.json({ ok: true, data: roadmap });
  } catch (e) {
    return handleApiError(e);
  }
}
