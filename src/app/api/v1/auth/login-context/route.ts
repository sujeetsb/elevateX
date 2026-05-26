import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getLoginPortalForEmail } from '@/lib/auth/login-portal';
import { handleApiError } from '@/server/errors/handler';
import { enforceRateLimit } from '@/server/rate-limit/upstash-route';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  email: z.string().email().max(256),
});

/** Returns which login portal an email belongs to (no password verification). */
export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'anonymous';
    await enforceRateLimit(`auth.login-context:${ip}`, { limit: 30, window: '60 m' });

    const body = bodySchema.parse(await req.json());
    const portal = await getLoginPortalForEmail(body.email);

    if (!portal) {
      return NextResponse.json({ ok: true, data: { portal: null as null } });
    }

    return NextResponse.json({ ok: true, data: { portal } });
  } catch (e) {
    return handleApiError(e);
  }
}
