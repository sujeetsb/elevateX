import { NextResponse } from 'next/server';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized } from '@/server/errors/http-error';
import { recomputeWeeklyStudyHours } from '@/server/services/weekly-study-hours.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const data = await recomputeWeeklyStudyHours(session.user.id);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return handleApiError(e);
  }
}
