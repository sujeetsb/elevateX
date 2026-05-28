import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isSuperAdminRole } from '@/lib/auth/roles';

const PUBLIC_PATHS = new Set(['/', '/about', '/terms', '/privacy', '/sign-in', '/sign-up']);

type RoutingState = {
  authenticated: boolean;
  registered: boolean;
  onboardingComplete: boolean;
  isSuperAdmin?: boolean;
  role?: string | null;
};

function redirect(req: NextRequest, pathname: string, search?: Record<string, string>) {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  url.search = '';
  if (search) {
    for (const [k, v] of Object.entries(search)) url.searchParams.set(k, v);
  }
  return NextResponse.redirect(url);
}

async function fetchRoutingState(req: NextRequest): Promise<RoutingState | null> {
  try {
    const origin = req.nextUrl.origin;
    const res = await fetch(`${origin}/api/v1/auth/routing-state`, {
      headers: { cookie: req.headers.get('cookie') ?? '' },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const json = await res.json();
    const data = json?.data;
    if (!data || typeof data !== 'object') return null;
    return {
      authenticated: Boolean(data.authenticated),
      registered: Boolean(data.registered),
      onboardingComplete: Boolean(data.onboardingComplete),
      isSuperAdmin: Boolean(data.isSuperAdmin),
      role: typeof data.role === 'string' ? data.role : null,
    };
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  const isAuthenticated = !!token?.sub;
  const tokenRole = typeof token?.role === 'string' ? token.role : undefined;
  const tokenSuperAdmin = isSuperAdminRole(tokenRole);
  const tokenOnboarded = token?.onboardingComplete === true;

  const isAdminLogin = pathname === '/admin/login';
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/');
  const isAdminApi =
    pathname.startsWith('/api/admin/') || pathname.startsWith('/api/v1/admin/');

  // ── Admin API ────────────────────────────────────────────────────────────
  if (isAdminApi) {
    if (!isAuthenticated) {
      return NextResponse.json({ ok: false, message: 'Unauthorized' }, { status: 401 });
    }
    if (!tokenSuperAdmin) {
      return NextResponse.json({ ok: false, message: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.next();
  }

  const justLoggedOut = req.nextUrl.searchParams.get('loggedOut') === '1';

  // ── Admin login (public) ───────────────────────────────────────────────────
  if (isAdminLogin) {
    if (isAuthenticated && tokenSuperAdmin && !justLoggedOut) return redirect(req, '/admin');
    return NextResponse.next();
  }

  // ── Admin panel (SUPER_ADMIN only) ─────────────────────────────────────────
  if (isAdminRoute) {
    if (!isAuthenticated) return redirect(req, '/admin/login');
    if (!tokenSuperAdmin) return redirect(req, '/admin/login');
    return NextResponse.next();
  }

  const isApp = pathname === '/app' || pathname.startsWith('/app/');
  const isOnboarding = pathname === '/onboarding' || pathname.startsWith('/onboarding/');

  // DB-backed routing only for app shells — JWT is enough for marketing redirects.
  const needsDbRouting = isAuthenticated && (isApp || isOnboarding);
  const routing = needsDbRouting ? await fetchRoutingState(req) : null;

  const onboarded = routing?.onboardingComplete ?? tokenOnboarded;
  const isSuperAdmin = routing?.isSuperAdmin ?? tokenSuperAdmin;

  if (isAuthenticated && routing && !routing.registered) {
    return redirect(req, '/sign-up', { loggedOut: '1', reason: 'unregistered' });
  }

  // ── User app + onboarding — block SUPER_ADMIN ──────────────────────────────
  if (isApp || isOnboarding) {
    if (!isAuthenticated) return redirect(req, '/sign-in');
    if (isSuperAdmin) return redirect(req, '/admin');
    if (isApp && !onboarded) return redirect(req, '/onboarding');
    if (isOnboarding && onboarded) return redirect(req, '/app/dashboard');
    return NextResponse.next();
  }

  // Marketing pages: trust JWT to avoid a Prisma round-trip on every visit.
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
