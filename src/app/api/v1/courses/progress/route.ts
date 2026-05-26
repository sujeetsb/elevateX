import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized } from '@/server/errors/http-error';
import { completeLessonForUser } from '@/server/services/course-progress.service';
import { getCourseForUser } from '@/server/services/course.service';
import { enforceRateLimit } from '@/server/rate-limit/upstash-route';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  courseId: z.string().min(1),
  lessonId: z.string().min(1),
  quizScore: z.number().int().min(0).max(100).optional(),
  timeSpentMinutes: z.number().int().min(1).max(480).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();
    await enforceRateLimit(`user:${session.user.id}:courses.progress`, { limit: 120, window: '60 m' });

    const body = bodySchema.parse(await req.json());

    const result = await completeLessonForUser({
      userId: session.user.id,
      courseId: body.courseId,
      lessonId: body.lessonId,
      quizScore: body.quizScore,
      timeSpentMinutes: body.timeSpentMinutes,
    });

    const course = await getCourseForUser(session.user.id, body.courseId);

    return NextResponse.json({ ok: true, data: { ...result, course } });
  } catch (e) {
    return handleApiError(e);
  }
}
