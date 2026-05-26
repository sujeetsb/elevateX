import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized } from '@/server/errors/http-error';
import { enforceRateLimit } from '@/server/rate-limit/upstash-route';
import { generateAndPersistCourse } from '@/server/services/course-generation.service';
import { mapCourseToClient, getCourseForUser } from '@/server/services/course.service';
import { assertCourseGenerationAllowed } from '@/server/subscription/require-pro';
import { awardGamificationXp } from '@/server/gamification/gamification.service';
import { cacheService } from '@/server/cache/cache-service';
import { prisma } from '@/server/db/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const bodySchema = z.object({
  title: z.string().min(1).max(200),
  goals: z.array(z.string()).max(8).default([]),
  skillLevel: z.string().default('Intermediate'),
  durationDays: z.number().int().min(7).max(90).default(30),
  learningStyle: z.string().default('Mixed Approach'),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();
    await enforceRateLimit(`user:${session.user.id}:courses.generate`, { limit: 5, window: '60 m' });
    await assertCourseGenerationAllowed(session.user.id);

    const body = bodySchema.parse(await req.json());

    const { course, cached } = await generateAndPersistCourse({
      userId: session.user.id,
      title: body.title,
      goals: body.goals,
      skillLevel: body.skillLevel,
      durationDays: body.durationDays,
      learningStyle: body.learningStyle,
    });

    if (!cached) {
      await awardGamificationXp({
        userId: session.user.id,
        amount: 150,
        actionKey: `course-gen:${course.id}`,
        actionType: 'COURSE_START',
      });
      await prisma.activityLog.create({
        data: {
          userId: session.user.id,
          verb: 'COURSE_START',
          subject: course.id,
          metadata: { title: course.title },
        },
      });
    }

    await cacheService.invalidateUser(session.user.id);

    const mapped = await getCourseForUser(session.user.id, course.id);
    if (!mapped) {
      return NextResponse.json(
        { ok: false, message: 'Course generation completed but the course could not be loaded. Please refresh and try again.' },
        { status: 503 },
      );
    }
    return NextResponse.json({
      ok: true,
      data: {
        accepted: true,
        cached,
        course: mapped,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
