import { NextResponse } from 'next/server';
import { z } from 'zod';
import { handleApiError } from '@/server/errors/handler';
import { extractOnboardingResumeFromText } from '@/server/services/onboarding-resume-extract.service';
import { getSession } from '@/server/http/get-session';
import { unauthorized } from '@/server/errors/http-error';
import { enforceRateLimit } from '@/server/rate-limit/upstash-route';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MIN_CHARS = 20;
const MAX_CHARS = 100_000;

const bodySchema = z.object({
  text: z
    .string()
    .min(MIN_CHARS, `Resume text must be at least ${MIN_CHARS} characters.`)
    .max(MAX_CHARS, `Resume text must be under ${MAX_CHARS.toLocaleString()} characters.`),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();
    await enforceRateLimit(`user:${session.user.id}:onboarding.parse-text`, { limit: 15, window: '60 m' });

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return NextResponse.json(
        { ok: false, error: { code: 'BAD_REQUEST', message: 'Invalid request body.' } },
        { status: 400 },
      );
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'BAD_REQUEST',
            message: parsed.error.errors[0]?.message ?? 'Validation failed.',
          },
        },
        { status: 400 },
      );
    }

    const data = await extractOnboardingResumeFromText(parsed.data.text);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return handleApiError(e);
  }
}
