import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isSuperAdminRole } from '@/lib/auth/roles';

const PUBLIC_PATHS = new Set(['/', '/about', '/terms', '/privacy', '/sign-in', '/sign-up']);

function redirect(req: NextRequest, pathname: string) {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  return NextResponse.redirect(url);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isAuthenticated = !!token?.sub;
  const role = typeof token?.role === 'string' ? token.role : undefined;
  const isSuperAdmin = isSuperAdminRole(role);
  const onboarded = token?.onboardingComplete === true;

  const isAdminLogin = pathname === '/admin/login';
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');
  const isAdminApi =
    pathname.startsWith('/api/admin/') || pathname.startsWith('/api/v1/admin/');

  // ── Admin API ────────────────────────────────────────────────────────────
  if (isAdminApi) {
    if (!isAuthenticated) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }
    if (!isSuperAdmin) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.next();
  }

  const justLoggedOut = req.nextUrl.searchParams.get('loggedOut') === '1';

  // ── Admin login (public) ───────────────────────────────────────────────────
  if (isAdminLogin) {
    if (isAuthenticated && isSuperAdmin && !justLoggedOut) return redirect(req, '/admin');
    return NextResponse.next();
  }

  // ── Admin panel (SUPER_ADMIN only) ─────────────────────────────────────────
  if (isAdminRoute) {
    if (!isAuthenticated) return redirect(req, '/admin/login');
    if (!isSuperAdmin) return redirect(req, '/admin/login');
    return NextResponse.next();
  }

  // ── User app + onboarding — block SUPER_ADMIN ──────────────────────────────
  const isApp = pathname === '/app' || pathname.startsWith('/app/');
  const isOnboarding = pathname === '/onboarding' || pathname.startsWith('/onboarding/');

  if (isApp || isOnboarding) {
    if (!isAuthenticated) return redirect(req, '/sign-in');
    if (isSuperAdmin) return redirect(req, '/admin');
    if (isApp && !onboarded) return redirect(req, '/onboarding');
    if (isOnboarding && onboarded) return redirect(req, '/app/dashboard');
    return NextResponse.next();
  }

  // ── Public marketing: authed users ─────────────────────────────────────────
  if (PUBLIC_PATHS.has(pathname) && isAuthenticated) {
    if (justLoggedOut && (pathname === '/sign-in' || pathname === '/sign-up')) {
      return NextResponse.next();
    }
    if (isSuperAdmin) return redirect(req, '/admin');
    return redirect(req, onboarded ? '/app/dashboard' : '/onboarding');
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/about',
    '/terms',
    '/privacy',
    '/sign-in',
    '/sign-up',
    '/onboarding',
    '/onboarding/:path*',
    '/app/:path*',
    '/admin',
    '/admin/:path*',
    '/api/admin/:path*',
    '/api/v1/admin/:path*',
  ],
};
