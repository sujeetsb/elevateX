import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/server/http/get-session';
import { unauthorized } from '@/server/errors/http-error';
import { handleApiError } from '@/server/errors/handler';
import { awardGamificationXp } from '@/server/gamification/gamification.service';
import { enforceRateLimit } from '@/server/rate-limit/upstash-route';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  amount: z.number().int().min(1).max(50_000),
  actionKey: z.string().min(1).max(200).optional(),
  actionType: z.string().min(1).max(80).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    await enforceRateLimit(`user:${session.user.id}:gamification.award`, { limit: 30, window: '1 m' });

    const body = bodySchema.parse(await req.json());

    const gamification = await awardGamificationXp({
      userId: session.user.id,
      amount: body.amount,
      actionKey: body.actionKey,
      actionType: body.actionType,
    });

    return NextResponse.json({ ok: true, data: gamification });
  } catch (e) {
    return handleApiError(e);
  }
}

