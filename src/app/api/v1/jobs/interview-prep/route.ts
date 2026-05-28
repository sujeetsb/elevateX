import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized, notFound } from '@/server/errors/http-error';
import { enforceRateLimit } from '@/server/rate-limit/upstash-route';
import { requireProSession } from '@/server/subscription/require-pro';
import { spendGamificationXp } from '@/server/gamification/gamification.service';
import { getXpCost } from '@/lib/gamification/xp-costs';
import { prisma } from '@/server/db/prisma';
import {
  generateInterviewPrepForJob,
  getInterviewPrepForJob,
} from '@/server/services/job-interview-prep.service';

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
    await enforceRateLimit(`user:${session.user.id}:interview-prep`, { limit: 8, window: '60 m' });

    const body = bodySchema.parse(await req.json());
    const xpCost = getXpCost('INTERVIEW_PREP');
    const actionKey = `interview-prep:${body.jobId}:${new Date().toISOString().slice(0, 10)}`;

    await spendGamificationXp({
      userId: session.user.id,
      amount: xpCost,
      actionKey,
      actionType: 'INTERVIEW_PREP',
    });

    const payload = await generateInterviewPrepForJob({
      userId: session.user.id,
      jobId: body.jobId,
      jobTitle: body.jobTitle,
      company: body.company,
      jobDescription: body.jobDescription,
    });

    await prisma.activityLog.create({
      data: {
        userId: session.user.id,
        verb: 'AI_CHAT',
        subject: body.jobId,
        metadata: { feature: 'interview-prep', xpCost },
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

    const payload = await getInterviewPrepForJob(session.user.id, jobId);
    if (!payload) return NextResponse.json({ ok: true, data: null });

    return NextResponse.json({ ok: true, data: payload });
  } catch (e) {
    return handleApiError(e);
  }
}
