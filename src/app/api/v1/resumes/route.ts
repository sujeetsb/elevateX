import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db/prisma';
import { inngest } from '@/server/inngest/client';
import { awardGamificationXp } from '@/server/gamification/gamification.service';
import { getSession } from '@/server/http/get-session';
import { cacheService } from '@/server/cache/cache-service';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized, badRequest } from '@/server/errors/http-error';
import { extractResumeText } from '@/server/resume/extract-text';
import { fetchResumeBytesFromUrl, validateUpload } from '@/lib/storage/provider';
import { validateResumeUpload } from '@/lib/resume/validate-upload';
import { enforceRateLimit } from '@/server/rate-limit/upstash-route';

export const dynamic = 'force-dynamic';

const MAX_BYTES = 10 * 1024 * 1024;

const createJsonSchema = z.object({
  title: z.string().max(120).optional(),
  rawText: z.string().min(20).max(100_000),
});

function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

async function bodyFromUploadThing(asset: ReturnType<typeof validateUpload>): Promise<{
  rawText: string;
  mimeType: string | undefined;
  filePublicId: string;
  fileUrl: string;
}> {
  const buf = await fetchResumeBytesFromUrl(asset.fileUrl);
  if (buf.byteLength > MAX_BYTES) throw badRequest('File too large (max 10MB)');
  const { text, mime } = await extractResumeText(buf, asset.mimeType ?? asset.fileName);
  if (text.length < 20) throw badRequest('Could not extract enough text from the file');
  return {
    rawText: text,
    mimeType: mime,
    filePublicId: asset.fileKey,
    fileUrl: asset.fileUrl,
  };
}

export async function GET(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const { searchParams } = new URL(req.url);
    const metaOnly = searchParams.get('meta') === '1';

    const list = await prisma.resume.findMany({
      where: { userId: session.user.id, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
      select: metaOnly
        ? {
            id: true,
            title: true,
            parseStatus: true,
            atsScore: true,
            parseVersion: true,
            lastParsedAt: true,
            updatedAt: true,
            createdAt: true,
          }
        : {
            id: true,
            title: true,
            parseStatus: true,
            parsedJson: true,
            atsScore: true,
            parseVersion: true,
            contentHash: true,
            lastParsedAt: true,
            updatedAt: true,
            createdAt: true,
          },
    });

    return NextResponse.json({ ok: true, data: list });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    await enforceRateLimit(`user:${session.user.id}:resumes.upload`, { limit: 12, window: '60 m' });

    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      throw badRequest('Expected application/json. Upload the file with UploadThing, then POST fileUrl + fileKey + fileName, or send rawText for paste-only resumes.');
    }

    const json = await req.json();

    let rawText: string;
    let title = 'Uploaded resume';
    let mimeType: string | undefined;
    let filePublicId: string | null = null;
    let fileUrl: string | null = null;

    if (json && typeof json === 'object' && 'fileUrl' in json && json.fileUrl) {
      const asset = validateUpload(json);
      const fileCheck = validateResumeUpload(asset.fileName, asset.mimeType);
      if (!fileCheck.ok) throw badRequest(fileCheck.message);
      if (asset.title?.trim()) title = asset.title.trim().slice(0, 120);
      const extracted = await bodyFromUploadThing(asset);
      rawText = extracted.rawText;
      mimeType = extracted.mimeType ?? asset.mimeType;
      filePublicId = extracted.filePublicId;
      fileUrl = extracted.fileUrl;
    } else {
      const body = createJsonSchema.parse(json);
      rawText = body.rawText;
      if (body.title) title = body.title;
    }

    const contentHash = sha256Hex(rawText);

    const duplicate = await prisma.resume.findFirst({
      where: { userId: session.user.id, contentHash, deletedAt: null },
      orderBy: { updatedAt: 'desc' },
    });

    if (duplicate?.parseStatus === 'COMPLETE' && duplicate.parsedJson) {
      if (!duplicate.filePublicId && filePublicId && fileUrl) {
        await prisma.resume.update({
          where: { id: duplicate.id },
          data: {
            filePublicId,
            fileUrl,
            mimeType: mimeType ?? duplicate.mimeType,
          },
        });
      }
      await cacheService.invalidateUser(session.user.id);
      return NextResponse.json({
        ok: true,
        data: {
          resumeId: duplicate.id,
          status: duplicate.parseStatus,
          duplicate: true,
          skippedParse: true,
          resumeParsed: true,
          profileVersion: null,
          parsedJson: duplicate.parsedJson,
        },
      });
    }

    if (duplicate && (duplicate.parseStatus === 'PENDING' || duplicate.parseStatus === 'PROCESSING')) {
      await cacheService.invalidateUser(session.user.id);
      return NextResponse.json({
        ok: true,
        data: {
          resumeId: duplicate.id,
          status: duplicate.parseStatus,
          duplicate: true,
          skippedParse: true,
          parseInFlight: true,
          resumeParsed: false,
          profileVersion: null,
        },
      });
    }

    if (duplicate) {
      const updated = await prisma.resume.update({
        where: { id: duplicate.id },
        data: {
          rawText,
          title,
          mimeType: mimeType ?? duplicate.mimeType,
          contentHash,
          parseStatus: 'PENDING',
          parseError: null,
          ...(filePublicId && fileUrl
            ? { filePublicId, fileUrl }
            : { filePublicId: duplicate.filePublicId, fileUrl: duplicate.fileUrl }),
        },
      });
      await cacheService.invalidateUser(session.user.id);
      await inngest.send({ name: 'app/resume.parse', data: { resumeId: updated.id } });
      return NextResponse.json({
        ok: true,
        data: {
          resumeId: updated.id,
          status: updated.parseStatus,
          duplicate: true,
          resumeParsed: false,
          profileVersion: null,
        },
      });
    }

    const resume = await prisma.resume.create({
      data: {
        userId: session.user.id,
        title,
        rawText,
        contentHash,
        mimeType,
        filePublicId,
        fileUrl,
        parseStatus: 'PENDING',
      },
    });

    await cacheService.invalidateUser(session.user.id);

    await inngest.send({
      name: 'app/resume.parse',
      data: { resumeId: resume.id },
    });

    const today = new Date().toISOString().slice(0, 10);
    await awardGamificationXp({
      userId: session.user.id,
      amount: 30,
      actionKey: `resume-upload:${resume.id}:${today}`,
      actionType: 'RESUME_UPLOAD',
    });

    return NextResponse.json({
      ok: true,
      data: { resumeId: resume.id, status: resume.parseStatus, resumeParsed: false, profileVersion: null },
    }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
