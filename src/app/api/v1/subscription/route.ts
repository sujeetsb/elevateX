import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/server/db/prisma';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { unauthorized } from '@/server/errors/http-error';
import { invalidateUserProfileCache } from '@/server/cache/invalidate-user-profile';
import { cacheService } from '@/server/cache/cache-service';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  tier: z.enum(['FREE', 'PRO', 'ENTERPRISE']),
});

export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
      select: { subscriptionTier: true },
    });

    return NextResponse.json({
      ok: true,
      data: { tier: profile?.subscriptionTier ?? 'FREE' },
    });
  } catch (e) {
    return handleApiError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const session = await getSession();
    if (!session?.user?.id) throw unauthorized();

    const { tier } = bodySchema.parse(await req.json());

    const profile = await prisma.profile.upsert({
      where: { userId: session.user.id },
      create: { userId: session.user.id, subscriptionTier: tier },
      update: { subscriptionTier: tier },
      select: { subscriptionTier: true },
    });

    await invalidateUserProfileCache(session.user.id);
    await cacheService.invalidateUser(session.user.id);

    return NextResponse.json({ ok: true, data: { tier: profile.subscriptionTier } });
  } catch (e) {
    return handleApiError(e);
  }
}
