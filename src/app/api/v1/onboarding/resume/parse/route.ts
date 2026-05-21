import { NextResponse } from 'next/server';
import { z } from 'zod';
import { extractResumeText } from '@/server/resume/extract-text';
import { extractOnboardingResumeFromText } from '@/server/services/onboarding-resume-extract.service';
import { handleApiError } from '@/server/errors/handler';
import { fetchResumeBytesFromUrl } from '@/lib/storage/provider';
import { getSession } from '@/server/http/get-session';
import { unauthorized } from '@/server/errors/http-error';
import { enforceRateLimit } from '@/server/rate-limit/upstash-route';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024;

const parseFromUrlSchema = z.object({
  fileUrl: z.string().url(),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().max(120).optional(),
});

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();
    await enforceRateLimit(`user:${session.user.id}:onboarding.parse`, { limit: 15, window: '60 m' });

    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Expected application/json with { fileUrl, fileName, mimeType? } (UploadThing ufsUrl after client upload).',
          },
        },
        { status: 400 },
      );
    }

    const json = await req.json();
    const body = parseFromUrlSchema.parse(json);
    const buf = await fetchResumeBytesFromUrl(body.fileUrl);
    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: { code: 'BAD_REQUEST', message: 'File too large (max 10MB).' } },
        { status: 400 },
      );
    }
    const { text } = await extractResumeText(buf, body.mimeType ?? body.fileName);
    if (!text || text.length < 20) {
      return NextResponse.json(
        { ok: false, error: { code: 'BAD_REQUEST', message: 'Could not extract enough text from file.' } },
        { status: 400 },
      );
    }
    const data = await extractOnboardingResumeFromText(text);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return handleApiError(e);
  }
}
