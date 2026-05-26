import { prisma } from '@/server/db/prisma';
import { isSuperAdminRole } from '@/lib/auth/roles';

export type LoginPortal = 'user' | 'admin';

export async function getLoginPortalForEmail(email: string): Promise<LoginPortal | null> {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return null;

  const user = await prisma.user.findFirst({
    where: { email: normalized, deletedAt: null },
    select: { role: true, suspendedAt: true },
  });

  if (!user || user.suspendedAt) return null;
  return isSuperAdminRole(user.role) ? 'admin' : 'user';
}
