import { getSession } from '@/server/http/get-session';
import { prisma } from '@/server/db/prisma';
import { forbidden, unauthorized } from '@/server/errors/http-error';

export function isProTier(tier: string | null | undefined): boolean {
  const t = (tier ?? 'FREE').trim().toUpperCase();
  return t === 'PRO' || t === 'ENTERPRISE';
}

export async function requireProSession() {
  const session = await getSession();
  if (!session?.user?.id) throw unauthorized();

  const tier = await getUserSubscriptionTier(session.user.id);
  if (!isProTier(tier)) {
    throw forbidden('This feature requires a PRO subscription.');
  }

  return { session, tier };
}

export async function getUserSubscriptionTier(userId: string): Promise<string> {
  const profile = await prisma.profile.findUnique({
    where: { userId },
    select: { subscriptionTier: true },
  });
  return (profile?.subscriptionTier ?? 'FREE').trim();
}

/** FREE users limited to 2 AI-generated courses. */
export async function assertCourseGenerationAllowed(userId: string) {
  const tier = await getUserSubscriptionTier(userId);
  if (isProTier(tier)) return;

  const count = await prisma.course.count({
    where: { userId, aiGenerated: true, deletedAt: null },
  });
  if (count >= 2) {
    throw forbidden('Free plan allows 2 AI courses. Upgrade to PRO for unlimited courses.');
  }
}
