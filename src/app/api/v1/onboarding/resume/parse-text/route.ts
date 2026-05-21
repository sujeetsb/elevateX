import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/server/errors/handler';
import { extractOnboardingResumeFromText } from '@/server/services/onboarding-resume-extract.service';
import { getSession } from '@/server/http/get-session';
import { unauthorized } from '@/server/errors/http-error';
import { enforceRateLimit } from '@/server/rate-limit/upstash-route';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  text: z.string().min(20).max(100_000),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();
    await enforceRateLimit(`user:${session.user.id}:onboarding.parse-text`, { limit: 15, window: '60 m' });

    const json = await req.json();
    const body = bodySchema.parse(json);
    const data = await extractOnboardingResumeFromText(body.text);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return handleApiError(e);
  }
}

