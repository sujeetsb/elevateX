import { getSession } from '@/server/http/get-session';
import { forbidden, unauthorized } from '@/server/errors/http-error';
import { isSuperAdminRole } from '@/lib/auth/roles';

export async function requireAdminSession() {
  const session = await getSession();
  if (!session?.user?.id) throw unauthorized();
  if (!isSuperAdminRole(session.user.role)) throw forbidden('Super admin access required');
  return session;
}
