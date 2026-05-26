import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized, notFound } from '@/server/errors/http-error';
import { enrollUserInCourse, getCourseForUser } from '@/server/services/course.service';
import { generateAndPersistCourse } from '@/server/services/course-generation.service';
import { awardGamificationXp } from '@/server/gamification/gamification.service';
import { prisma } from '@/server/db/prisma';
import { cacheService } from '@/server/cache/cache-service';
import { enforceRateLimit } from '@/server/rate-limit/upstash-route';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  courseId: z.string().optional(),
  courseTitle: z.string().optional(),
  resourceId: z.string().optional(),
  generateIfMissing: z.boolean().default(true),
});

/** Enroll in existing course or generate from recommendation title. */
export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();
    await enforceRateLimit(`user:${session.user.id}:courses.enroll`, { limit: 30, window: '60 m' });

    const body = bodySchema.parse(await req.json());
    let courseId = body.courseId;

    if (!courseId && body.resourceId && !body.resourceId.startsWith('rec-') && !body.resourceId.startsWith('insight-')) {
      courseId = body.resourceId;
    }

    if (!courseId && body.courseTitle && body.generateIfMissing) {
      const { course } = await generateAndPersistCourse({
        userId: session.user.id,
        title: body.courseTitle,
        goals: [],
        skillLevel: 'Intermediate',
        durationDays: 14,
      });
      courseId = course.id;
    }

    if (!courseId) throw notFound('Course not found');

    await enrollUserInCourse(session.user.id, courseId);

    const today = new Date().toISOString().slice(0, 10);
    await awardGamificationXp({
      userId: session.user.id,
      amount: 15,
      actionKey: `course-start:${courseId}:${today}`,
      actionType: 'COURSE_START',
    });

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        verb: 'COURSE_START',
        subject: courseId,
        metadata: { title: body.courseTitle ?? null },
      },
    });

    await cacheService.invalidateUser(session.user.id);

    const course = await getCourseForUser(session.user.id, courseId);
    return NextResponse.json({ ok: true, data: { courseId, course } });
  } catch (e) {
    return handleApiError(e);
  }
}
