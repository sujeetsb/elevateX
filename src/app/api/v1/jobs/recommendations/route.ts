import { NextResponse } from 'next/server';
import { getSession } from '@/server/http/get-session';
import { getRankedJobsForUser } from '@/server/services/job-recommendation.service';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized } from '@/server/errors/http-error';
import { cacheService } from '@/server/cache/cache-service';
import { cacheKeys } from '@/server/cache/cache-keys';

export const dynamic = 'force-dynamic';

const JOB_REC_TTL_SEC = 300;

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const cacheKey = cacheKeys.jobRecommendations(session.user.id);
    const cached = await cacheService.getJson<Array<{
      score: number;
      reasons: string[];
      job: Record<string, unknown>;
    }>>(cacheKey);
    if (cached) {
      return NextResponse.json({ ok: true, source: 'cache', data: cached });
    }

    const ranked = await getRankedJobsForUser(session.user.id);
    const data = ranked.map(r => ({
      score: r.score,
      reasons: r.reasons,
      job: {
        id: r.job.id,
        title: r.job.title,
        company: r.job.company,
        location: r.job.location,
        url: r.job.url,
        source: r.job.source,
        salaryMin: r.job.salaryMin,
        salaryMax: r.job.salaryMax,
        currency: r.job.currency,
      },
    }));

    await cacheService.setJson(cacheKey, data, JOB_REC_TTL_SEC);
    return NextResponse.json({ ok: true, source: 'db', data });
  } catch (e) {
    return handleApiError(e);
  }
}
