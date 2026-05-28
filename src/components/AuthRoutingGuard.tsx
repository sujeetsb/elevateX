'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { signOutUnregistered } from '@/lib/auth/sign-out';
import {
  getRoutingCache,
  setRoutingCache,
  jwtMatchesPath,
  type RoutingStateData,
} from '@/lib/auth/routing-cache';

/** Syncs JWT session with DB routing state when needed; avoids redundant routing-state fetches. */
export function AuthRoutingGuard() {
  const { data: session, status, update } = useSession();
  const pathname = usePathname() ?? '';
  const router = useRouter();
  const syncInFlightRef = useRef(false);

  const applyRouting = useCallback(
    async (data: RoutingStateData) => {
      if (!session?.user?.id) return;

      if (data.authenticated && !data.registered) {
        toast.error('Your account is not registered. Please sign up.');
        await signOutUnregistered();
        return;
      }

      const dbOnboarded = Boolean(data.onboardingComplete);
      const jwtOnboarded = session.user.onboardingComplete === true;
      const dbTier = typeof data.subscriptionTier === 'string' ? data.subscriptionTier : undefined;

      if (dbOnboarded !== jwtOnboarded || (dbTier && dbTier !== session.user.subscriptionTier)) {
        await update({
          onboardingComplete: dbOnboarded,
          ...(dbTier ? { subscriptionTier: dbTier } : {}),
        });
      }

      const isApp = pathname.startsWith('/app');
      const isOnboarding = pathname.startsWith('/onboarding');

      if (isApp && !dbOnboarded) {
        router.replace('/onboarding');
      } else if (isOnboarding && dbOnboarded) {
        router.replace('/app/dashboard');
      }
    },
    [pathname, router, session?.user, update],
  );

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return;

    const userId = session.user.id;
    const jwtOnboarded = session.user.onboardingComplete;

    const cached = getRoutingCache(userId);
    if (cached) {
      void applyRouting(cached);
      return;
    }

    if (jwtMatchesPath({ pathname, jwtOnboarded })) {
      return;
    }

    if (syncInFlightRef.current) return;
    syncInFlightRef.current = true;

    void (async () => {
      try {
        const res = await fetch('/api/v1/auth/routing-state', { credentials: 'include', cache: 'no-store' });
        if (!res.ok) return;
        const json = await res.json();
        const data = json?.data as RoutingStateData | undefined;
        if (!data) return;
        setRoutingCache(userId, data);
        await applyRouting(data);
      } catch {
        // Non-fatal — middleware provides a fallback gate
      } finally {
        syncInFlightRef.current = false;
      }
    })();
  }, [status, session?.user?.id, session?.user?.onboardingComplete, session?.user?.subscriptionTier, pathname, applyRouting, session?.user]);

  useEffect(() => {
    if (status !== 'authenticated' || !session?.user?.id) return;

    const userId = session.user.id;
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent<{ onboardingComplete?: boolean; profileVersion?: number }>).detail;
      if (detail?.onboardingComplete !== undefined) {
        setRoutingCache(userId, {
          authenticated: true,
          registered: true,
          onboardingComplete: detail.onboardingComplete,
          subscriptionTier: session.user.subscriptionTier,
        });
        void update({ onboardingComplete: detail.onboardingComplete });
      }
    };

    window.addEventListener('cp-profile-loaded', handler);
    return () => window.removeEventListener('cp-profile-loaded', handler);
  }, [status, session?.user?.id, session?.user?.subscriptionTier, update]);

  return null;
}
