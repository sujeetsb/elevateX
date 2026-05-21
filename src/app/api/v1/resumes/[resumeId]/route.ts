import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db/prisma';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { notFound, unauthorized } from '@/server/errors/http-error';

export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  resumeId: z.string().min(1),
});

export async function GET(
  req: Request,
  context: { params: { resumeId: string } },
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const params = paramsSchema.parse(context.params);

    const resume = await prisma.resume.findFirst({
      where: { id: params.resumeId, userId: session.user.id, deletedAt: null },
      select: {
        id: true,
        parseStatus: true,
        parseVersion: true,
        atsScore: true,
        confidence: true,
        parsedJson: true,
        parseError: true,
        lastParsedAt: true,
        updatedAt: true,
      },
    });

    if (!resume) throw notFound('Resume not found');

    return NextResponse.json({
      ok: true,
      data: {
        resumeId: resume.id,
        parseStatus: resume.parseStatus,
        parseVersion: resume.parseVersion,
        atsScore: resume.atsScore,
        confidence: resume.confidence,
        parsedJson: resume.parsedJson,
        parseError: resume.parseError,
        lastParsedAt: resume.lastParsedAt,
        updatedAt: resume.updatedAt,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

