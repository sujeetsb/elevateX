import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '@/server/db/prisma';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { notFound, unauthorized, badRequest } from '@/server/errors/http-error';
import { cacheService } from '@/server/cache/cache-service';
import { cacheKeys } from '@/server/cache/cache-keys';

export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  resumeId: z.string().min(1),
});

const patchSchema = z.object({
  studioDocument: z.record(z.unknown()).optional(),
  title: z.string().min(1).max(120).optional(),
});

export async function PATCH(
  req: Request,
  context: { params: { resumeId: string } },
) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const params = paramsSchema.parse(context.params);
    const body = patchSchema.parse(await req.json());

    const existing = await prisma.resume.findFirst({
      where: { id: params.resumeId, userId: session.user.id, deletedAt: null },
      select: { id: true, parsedJson: true },
    });
    if (!existing) throw notFound('Resume not found');

    const prevParsed =
      existing.parsedJson && typeof existing.parsedJson === 'object'
        ? (existing.parsedJson as Record<string, unknown>)
        : {};

    const nextParsed = body.studioDocument
      ? { ...prevParsed, studioDocument: body.studioDocument }
      : prevParsed;

    const updated = await prisma.resume.update({
      where: { id: existing.id },
      data: {
        ...(body.title ? { title: body.title } : {}),
        ...(body.studioDocument ? { parsedJson: nextParsed as Prisma.InputJsonValue } : {}),
      },
      select: {
        id: true,
        title: true,
        parseStatus: true,
        atsScore: true,
        updatedAt: true,
        parsedJson: true,
      },
    });

    await cacheService.del(cacheKeys.userProfile(session.user.id));

    return NextResponse.json({ ok: true, data: updated });
  } catch (e) {
    if (e instanceof z.ZodError) throw badRequest('Invalid resume update payload');
    return handleApiError(e);
  }
}

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

