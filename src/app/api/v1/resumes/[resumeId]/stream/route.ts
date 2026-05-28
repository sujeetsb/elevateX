import { prisma } from '@/server/db/prisma';
import { getSession } from '@/server/http/get-session';
import { unauthorized, notFound } from '@/server/errors/http-error';
import { kickStuckResumeParse } from '@/server/services/resume-parse-runner.service';

export const dynamic = 'force-dynamic';

const STAGES = ['UPLOADING', 'PARSING', 'ATS_GENERATION', 'PROFILE_EXTRACTION', 'COMPLETE', 'FAILED'] as const;

function mapProgress(status: string): { stage: string; percent: number } {
  switch (status) {
    case 'PENDING':
      return { stage: 'UPLOADING', percent: 20 };
    case 'PROCESSING':
      return { stage: 'PARSING', percent: 50 };
    case 'COMPLETE':
      return { stage: 'COMPLETE', percent: 100 };
    case 'FAILED':
      return { stage: 'FAILED', percent: 0 };
    default:
      return { stage: 'UPLOADING', percent: 20 };
  }
}

/** SSE stream for live resume parse status. */
export async function GET(req: Request) {
  const session = await getSession();
  if (!session?.user?.id) throw unauthorized();

  const { searchParams } = new URL(req.url);
  const resumeId = searchParams.get('resumeId');
  if (!resumeId) throw notFound('resumeId required');

  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      send({ type: 'connected', stages: STAGES });

      for (let i = 0; i < 120 && !closed; i++) {
        const resume = await prisma.resume.findFirst({
          where: { id: resumeId, userId: session.user!.id, deletedAt: null },
          select: {
            parseStatus: true,
            parseError: true,
            atsScore: true,
            lastParsedAt: true,
            createdAt: true,
          },
        });

        if (!resume) {
          send({ type: 'error', message: 'Resume not found' });
          break;
        }

        if (resume.parseStatus === 'PENDING' && i === 0) {
          void kickStuckResumeParse(resumeId, resume.createdAt);
        }

        const { stage, percent } = mapProgress(resume.parseStatus);
        let subPercent = percent;
        if (resume.parseStatus === 'PROCESSING' && resume.atsScore != null) {
          subPercent = 80;
        }

        send({
          type: 'progress',
          parseStatus: resume.parseStatus,
          stage,
          percent: subPercent,
          atsScore: resume.atsScore,
          parseError: resume.parseError,
          resumeAnalyzed: resume.parseStatus === 'COMPLETE',
        });

        if (resume.parseStatus === 'COMPLETE' || resume.parseStatus === 'FAILED') {
          break;
        }

        await new Promise(r => setTimeout(r, 1500));
      }

      controller.close();
    },
    cancel() {
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
