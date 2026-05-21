import { NextResponse } from 'next/server';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized } from '@/server/errors/http-error';
import { claimDailyBonus } from '@/server/gamification/gamification.service';
import { enforceRateLimit } from '@/server/rate-limit/upstash-route';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    await enforceRateLimit(`user:${session.user.id}:gamification.daily_claim`, { limit: 8, window: '1 m' });

    const result = await claimDailyBonus(session.user.id);
    return NextResponse.json({ ok: true, data: result });
  } catch (e) {
    return handleApiError(e);
  }
}
