import { NextResponse } from 'next/server';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized } from '@/server/errors/http-error';
import { listUserCourseCertificates } from '@/server/services/course-certificate.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const certs = await listUserCourseCertificates(session.user.id);
    return NextResponse.json({
      ok: true,
      data: certs.map(c => ({
        id: c.id,
        certificateId: c.certificateId,
        userName: c.userName,
        courseTitle: c.courseTitle,
        courseId: c.courseId,
        completedAt: c.completedAt,
        xpEarned: c.xpEarned,
        difficulty: c.course.difficulty,
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
