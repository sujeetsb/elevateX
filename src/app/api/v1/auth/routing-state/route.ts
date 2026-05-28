import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/prisma';
import { getSession } from '@/server/http/get-session';
import { handleApiError } from '@/server/errors/handler';
import { isSuperAdminRole } from '@/lib/auth/roles';

export const dynamic = 'force-dynamic';

/** DB-backed routing truth for middleware and client guards (JWT can be stale). */
export async function GET() {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({
        ok: true,
        data: { authenticated: false, registered: false, onboardingComplete: false },
      });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        role: true,
        deletedAt: true,
        suspendedAt: true,
        profile: { select: { onboardingComplete: true, subscriptionTier: true } },
      },
    });

    if (!dbUser || dbUser.deletedAt || dbUser.suspendedAt) {
      return NextResponse.json({
        ok: true,
        data: {
          authenticated: true,
          registered: false,
          onboardingComplete: false,
          role: null,
          subscriptionTier: 'FREE',
        },
      });
    }

    return NextResponse.json({
      ok: true,
      data: {
        authenticated: true,
        registered: true,
        onboardingComplete: dbUser.profile?.onboardingComplete === true,
        role: dbUser.role,
        isSuperAdmin: isSuperAdminRole(dbUser.role),
        subscriptionTier: dbUser.profile?.subscriptionTier ?? 'FREE',
      },
    });
  } catch (e) {
    return handleApiError(e);
  }
}
