import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db/prisma';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized, notFound } from '@/server/errors/http-error';
import { getFileUrl } from '@/lib/storage/provider';
import { enforceRateLimit } from '@/server/rate-limit/upstash-route';

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

    await enforceRateLimit(`user:${session.user.id}:resumes.download`, { limit: 120, window: '60 m' });

    const params = paramsSchema.parse(context.params);

    const resume = await prisma.resume.findFirst({
      where: { id: params.resumeId, userId: session.user.id, deletedAt: null },
      select: { id: true, filePublicId: true, fileUrl: true, mimeType: true },
    });

    if (!resume) throw notFound('Resume not found');
    if (!resume.filePublicId && !resume.fileUrl) throw notFound('Resume file not available');

    const url = resume.filePublicId
      ? await getFileUrl(resume.filePublicId, resume.fileUrl)
      : resume.fileUrl;
    if (!url) throw notFound('Resume file not available');

    return NextResponse.json({
      ok: true,
      data: {
        resumeId: resume.id,
        url,
        mimeType: resume.mimeType ?? undefined,
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
