import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db/prisma';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized, badRequest } from '@/server/errors/http-error';
import { invalidateUserProfileCache } from '@/server/cache/invalidate-user-profile';

export const dynamic = 'force-dynamic';

const optionalUrl = z
  .string()
  .max(512)
  .optional()
  .nullable()
  .transform(s => {
    if (s == null || !String(s).trim()) return null;
    const t = String(s).trim();
    if (/^https?:\/\//i.test(t)) return t.slice(0, 512);
    return `https://${t.replace(/^\/+/, '')}`.slice(0, 512);
  });

const certSchema = z.object({
  name: z.string().min(1).max(200),
  issuer: z.string().min(1).max(200),
  issueDate: z.string().max(32).optional().nullable(),
  expiryDate: z.string().max(32).optional().nullable(),
  credentialId: z.string().max(200).optional().nullable(),
  credentialUrl: optionalUrl,
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const certs = await prisma.userCertification.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ ok: true, data: certs });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const count = await prisma.userCertification.count({ where: { userId: session.user.id } });
    if (count >= 30) throw badRequest('Maximum 30 certifications allowed');

    const body = certSchema.parse(await req.json());

    const cert = await prisma.userCertification.create({
      data: {
        userId: session.user.id,
        name: body.name,
        issuer: body.issuer,
        issueDate: body.issueDate || null,
        expiryDate: body.expiryDate || null,
        credentialId: body.credentialId || null,
        credentialUrl: body.credentialUrl || null,
      },
    });

    await invalidateUserProfileCache(session.user.id);

    return NextResponse.json({ ok: true, data: cert }, { status: 201 });
  } catch (e) {
    return handleApiError(e);
  }
}
