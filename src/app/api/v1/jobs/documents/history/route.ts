import { NextResponse } from 'next/server';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized } from '@/server/errors/http-error';
import { listJobDocumentHistory } from '@/server/services/job-cover-letter.service';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const rows = await listJobDocumentHistory(session.user.id);

    const data = rows.map(row => ({
      jobId: row.jobId,
      jobTitle: row.jobTitle,
      company: row.company,
      optimizedResume: row.optimizedResume
        ? {
            id: row.optimizedResume.id,
            template: row.optimizedResume.template,
            resumeVersion: row.optimizedResume.resumeVersion,
            atsScoreBefore: row.optimizedResume.atsScoreBefore,
            atsScoreAfter: row.optimizedResume.atsScoreAfter,
            updatedAt: row.optimizedResume.updatedAt.toISOString(),
          }
        : null,
      coverLetter: row.coverLetter
        ? {
            id: row.coverLetter.id,
            updatedAt: row.coverLetter.updatedAt.toISOString(),
          }
        : null,
      application: row.application
        ? {
            status: row.application.status,
            appliedAt: row.application.appliedAt?.toISOString() ?? null,
          }
        : null,
    }));

    return NextResponse.json({ ok: true, data });
  } catch (e) {
    return handleApiError(e);
  }
}
