import { NextResponse } from 'next/server';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized } from '@/server/errors/http-error';
import { generateUserInsights, getFreshUserInsights, getUserInsights } from '@/server/services/user-insights.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const insights = await getFreshUserInsights(session.user.id);
    return NextResponse.json({ ok: true, data: insights ?? (await getUserInsights(session.user.id)) });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST() {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const insights = await generateUserInsights(session.user.id, { force: true });
    return NextResponse.json({ ok: true, data: insights });
  } catch (e) {
    return handleApiError(e);
  }
}
