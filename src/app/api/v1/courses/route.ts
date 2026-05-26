import { NextResponse } from 'next/server';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized } from '@/server/errors/http-error';
import { listUserCourses, listUserCoursesSummary, getRecommendedCourses } from '@/server/services/course.service';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const { searchParams } = new URL(req.url);
    const view = searchParams.get('view');
    const summary = searchParams.get('summary') === '1';

    if (view === 'recommended') {
      const recs = await getRecommendedCourses(session.user.id);
      return NextResponse.json({ ok: true, data: recs });
    }

    const courses = summary
      ? await listUserCoursesSummary(session.user.id)
      : await listUserCourses(session.user.id);
    const continueLearning = courses.filter(c => c.progress > 0 && c.progress < 100);
    const completed = courses.filter(c => c.progress >= 100 || c.status === 'COMPLETED');
    const saved = courses.filter(c => c.saved);
    const active = courses.filter(c => c.progress < 100 && c.status !== 'COMPLETED');

    return NextResponse.json({
      ok: true,
      data: {
        all: courses,
        continueLearning,
        completed,
        saved,
        active,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
