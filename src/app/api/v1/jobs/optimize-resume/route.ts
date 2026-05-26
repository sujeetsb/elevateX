import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized, notFound } from '@/server/errors/http-error';
import { requireProSession } from '@/server/subscription/require-pro';
import {
  optimizeResumeForJob,
  getOptimizedResumeForJob,
  getOptimizedResume,
  listOptimizedResumes,
  rowToOptimizedPayload,
} from '@/server/services/job-resume-optimize.service';
import { enforceRateLimit } from '@/server/rate-limit/upstash-route';
import { prisma } from '@/server/db/prisma';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const bodySchema = z.object({
  jobId: z.string().min(1),
  jobTitle: z.string().min(1).max(200),
  company: z.string().max(200).optional(),
  jobDescription: z.string().min(20).max(20_000),
});

export async function POST(req: Request) {
  try {
    const { session } = await requireProSession();
    await enforceRateLimit(`user:${session.user.id}:jobs.optimize-resume`, { limit: 10, window: '60 m' });

    const body = bodySchema.parse(await req.json());
    const { id } = await optimizeResumeForJob({
      userId: session.user.id,
      jobId: body.jobId,
      jobTitle: body.jobTitle,
      company: body.company,
      jobDescription: body.jobDescription,
    });

    const row = await prisma.optimizedResume.findUniqueOrThrow({ where: { id } });
    const payload = rowToOptimizedPayload(row);

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
    const id = searchParams.get('id');

    if (jobId) {
      const payload = await getOptimizedResumeForJob(session.user.id, jobId);
      return NextResponse.json({ ok: true, data: payload });
    }

    if (id) {
      const payload = await getOptimizedResume(session.user.id, id);
      if (!payload) throw notFound('Optimized resume not found');
      return NextResponse.json({ ok: true, data: payload });
    }

    const list = await listOptimizedResumes(session.user.id);
    return NextResponse.json({ ok: true, data: list });
  } catch (e) {
    return handleApiError(e);
  }
}
