import { NextResponse } from 'next/server';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized, notFound } from '@/server/errors/http-error';
import { getCourseForUser } from '@/server/services/course.service';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const { id } = await ctx.params;
    const course = await getCourseForUser(session.user.id, id);
    if (!course) throw notFound('Course not found');

    return NextResponse.json({ ok: true, data: course });
  } catch (e) {
    return handleApiError(e);
  }
}
