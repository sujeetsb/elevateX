import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized, notFound } from '@/server/errors/http-error';
import { enforceRateLimit } from '@/server/rate-limit/upstash-route';
import { awardGamificationXp } from '@/server/gamification/gamification.service';
import { requireProSession } from '@/server/subscription/require-pro';
import { prisma } from '@/server/db/prisma';
import {
  generateCoverLetterForJob,
  getCoverLetterForJob,
} from '@/server/services/job-cover-letter.service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  jobId: z.string().min(1),
  jobTitle: z.string().min(1).max(200),
  company: z.string().min(1).max(200),
  jobDescription: z.string().min(20).max(8000),
});

export async function POST(req: Request) {
  try {
    const { session } = await requireProSession();
    await enforceRateLimit(`user:${session.user.id}:cover-letter`, { limit: 10, window: '60 m' });

    const body = bodySchema.parse(await req.json());
    const payload = await generateCoverLetterForJob({
      userId: session.user.id,
      jobId: body.jobId,
      jobTitle: body.jobTitle,
      company: body.company,
      jobDescription: body.jobDescription,
    });

    const today = new Date().toISOString().slice(0, 10);
    await awardGamificationXp({
      userId: session.user.id,
      amount: 10,
      actionKey: `cover-letter:${body.jobId}:${today}`,
      actionType: 'COVER_LETTER',
    });
    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        verb: 'COVER_LETTER',
        subject: body.jobId,
      },
    });

    return NextResponse.json({ ok: true, data: payload });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const { searchParams } = new URL(req.url);
    const jobId = searchParams.get('jobId');
    if (!jobId) throw notFound('jobId required');

    const payload = await getCoverLetterForJob(session.user.id, jobId);
    if (!payload) return NextResponse.json({ ok: true, data: null });

    return NextResponse.json({ ok: true, data: payload });
  } catch (e) {
    return handleApiError(e);
  }
}
