import { NextResponse } from 'next/server';
import { getSession } from '@/server/http/get-session';
import { getRankedJobsForUser } from '@/server/services/job-recommendation.service';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized } from '@/server/errors/http-error';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();
    const ranked = await getRankedJobsForUser(session.user.id);
    return NextResponse.json({
      ok: true,
      data: ranked.map(r => ({
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
        },
      })),
    });
  } catch (e) {
    return handleApiError(e);
  }
}
