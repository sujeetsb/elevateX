import { NextResponse } from 'next/server';
import { z } from 'zod';
import { extractResumeText } from '@/server/resume/extract-text';
import { extractOnboardingResumeFromText } from '@/server/services/onboarding-resume-extract.service';
import { handleApiError } from '@/server/errors/handler';
import { fetchResumeBytesFromUrl } from '@/lib/storage/provider';
import { getSession } from '@/server/http/get-session';
import { unauthorized } from '@/server/errors/http-error';
import { enforceRateLimit } from '@/server/rate-limit/upstash-route';
import { logger } from '@/server/logger';

export const dynamic = 'force-dynamic';
// Generous Lambda timeout so even a large PDF + slow Gemini call can complete.
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024;

const parseFromUrlSchema = z.object({
  fileUrl: z.string().url('Invalid file URL'),
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
            message: 'Expected application/json with { fileUrl, fileName, mimeType? }.',
          },
        },
        { status: 400 },
      );
    }

    const json = await req.json().catch(() => null);
    if (!json || typeof json !== 'object') {
      return NextResponse.json(
        { ok: false, error: { code: 'BAD_REQUEST', message: 'Invalid request body.' } },
        { status: 400 },
      );
    }

    const parsed = parseFromUrlSchema.safeParse(json);
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

    const body = parsed.data;

    let buf: Buffer;
    try {
      buf = await fetchResumeBytesFromUrl(body.fileUrl);
    } catch (fetchErr) {
      logger.warn('onboarding.parse fetch_failed', { url: body.fileUrl, error: String(fetchErr) });
      return NextResponse.json(
        { ok: false, error: { code: 'BAD_REQUEST', message: 'Could not fetch the uploaded file. Please try uploading again.' } },
        { status: 400 },
      );
    }

    if (buf.byteLength > MAX_BYTES) {
      return NextResponse.json(
        { ok: false, error: { code: 'BAD_REQUEST', message: 'File too large (max 10 MB). Please compress your resume and retry.' } },
        { status: 400 },
      );
    }

    let text: string;
    try {
      const result = await extractResumeText(buf, body.mimeType ?? body.fileName);
      text = result.text;
    } catch (extractErr) {
      logger.warn('onboarding.parse extract_failed', { error: String(extractErr) });
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'PARSE_ERROR',
            message: 'Resume parsing failed. Try a different file format (PDF, DOCX, or TXT), or paste your resume text manually.',
          },
        },
        { status: 422 },
      );
    }

    if (!text || text.length < 20) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: 'PARSE_ERROR',
            message: 'Could not extract readable text from this file. The file may be scanned/image-only. Try a different format or paste your resume text.',
          },
        },
        { status: 422 },
      );
    }

    const data = await extractOnboardingResumeFromText(text);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return handleApiError(e);
  }
}
