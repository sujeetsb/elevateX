/** Client-side routing state cache — avoids duplicate /auth/routing-state fetches per session. */

export type RoutingStateData = {
  authenticated: boolean;
  registered: boolean;
  onboardingComplete: boolean;
  subscriptionTier?: string;
  isSuperAdmin?: boolean;
  role?: string | null;
};

const CACHE_TTL_MS = 90_000;

function cacheKey(userId: string) {
  return `cp-routing-state:${userId}`;
}

export function getRoutingCache(userId: string): RoutingStateData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: RoutingStateData };
    if (Date.now() - parsed.at > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function setRoutingCache(userId: string, data: RoutingStateData) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(cacheKey(userId), JSON.stringify({ at: Date.now(), data }));
  } catch {
    // ignore quota errors
  }
}

export function clearRoutingCache(userId?: string) {
  if (typeof window === 'undefined') return;
  try {
    if (userId) sessionStorage.removeItem(cacheKey(userId));
    else {
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const k = sessionStorage.key(i);
        if (k?.startsWith('cp-routing-state:')) sessionStorage.removeItem(k);
      }
    }
  } catch {
    // ignore
  }
}

/** True when JWT onboarding flag matches the current path — middleware already gated /app and /onboarding. */
export function jwtMatchesPath(args: {
  pathname: string;
  jwtOnboarded: boolean | undefined;
}): boolean {
  if (args.jwtOnboarded === undefined) return false;
  const isApp = args.pathname.startsWith('/app');
  const isOnboarding = args.pathname.startsWith('/onboarding');
  if (isApp) return args.jwtOnboarded === true;
  if (isOnboarding) return args.jwtOnboarded === false;
  return true;
}
