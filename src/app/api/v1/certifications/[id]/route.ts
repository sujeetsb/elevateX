import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db/prisma';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized, notFound } from '@/server/errors/http-error';
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

const patchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  issuer: z.string().min(1).max(200).optional(),
  issueDate: z.string().max(32).optional().nullable(),
  expiryDate: z.string().max(32).optional().nullable(),
  credentialId: z.string().max(200).optional().nullable(),
  credentialUrl: optionalUrl,
});

async function ownedCert(userId: string, id: string) {
  const cert = await prisma.userCertification.findUnique({ where: { id } });
  if (!cert || cert.userId !== userId) throw notFound('Certification not found');
  return cert;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    await ownedCert(session.user.id, params.id);

    const body = patchSchema.parse(await req.json());

    const updated = await prisma.userCertification.update({
      where: { id: params.id },
      data: {
        ...(body.name !== undefined && { name: body.name }),
        ...(body.issuer !== undefined && { issuer: body.issuer }),
        issueDate: body.issueDate ?? undefined,
        expiryDate: body.expiryDate ?? undefined,
        credentialId: body.credentialId ?? undefined,
        credentialUrl: body.credentialUrl ?? undefined,
      },
    });

    await invalidateUserProfileCache(session.user.id);

    return NextResponse.json({ ok: true, data: updated });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    await ownedCert(session.user.id, params.id);

    await prisma.userCertification.delete({ where: { id: params.id } });

    await invalidateUserProfileCache(session.user.id);

    return NextResponse.json({ ok: true });
  } catch (e) {
    return handleApiError(e);
  }
}
