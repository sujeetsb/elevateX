'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { useGame } from './GameContext';
import { Sidebar } from './Sidebar';
import { appNavItems } from '@/lib/navigation/app-nav';
import { getQueryClient } from '@/lib/query-client';
import { insightsQueryKeys } from '@/lib/insights/query-keys';
import { apiFetchJson } from '@/lib/api/client';
import { usePrefetchProfileInsights } from '@/lib/hooks/use-profile-insights';
import { profileAnalyticsQueryKey } from '@/lib/hooks/use-profile-analytics';

export function Layout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const { data: session } = useSession();
  const { showXpBurst, lastXpGain, isAuthenticated, isHydrating, user } = useGame();
  const isMentor = pathname === '/app/mentor';
  const prefetchInsights = usePrefetchProfileInsights();
  const [navPending, setNavPending] = useState<string | null>(null);

  useEffect(() => {
    setNavPending(null);
  }, [pathname]);

  useEffect(() => {
    appNavItems.forEach(({ path }) => router.prefetch(path));
    router.prefetch('/app/mentor');
    router.prefetch('/app/ats');
    router.prefetch('/app/analytics');
  }, [router]);

  useEffect(() => {
    if (!session?.user?.id) return;
    const qc = getQueryClient();
    const profileVersion = user.profileVersion ?? 0;
    void prefetchInsights(profileVersion);
    void qc.prefetchQuery({
      queryKey: insightsQueryKeys.resumesMeta(),
      queryFn: () => apiFetchJson('/api/v1/resumes?meta=1'),
      staleTime: 2 * 60_000,
    });
    void qc.prefetchQuery({
      queryKey: profileAnalyticsQueryKey,
      queryFn: () => apiFetchJson('/api/v1/analytics/profile'),
      staleTime: 2 * 60_000,
    });
  }, [session?.user?.id, user.profileVersion, prefetchInsights]);

  useEffect(() => {
    if (isHydrating) return;
    if (!isAuthenticated) {
      router.replace('/sign-in');
    }
  }, [isHydrating, isAuthenticated, router]);

  const handleNavigate = (path: string) => {
    if (navPending || pathname === path) return;
    setNavPending(path);
    router.push(path);
  };

  return (
    <div className="aurora-bg min-h-screen flex" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Desktop sidebar — hidden below lg */}
      <Sidebar onNavigate={handleNavigate} navPending={navPending} />

      {/* Main area — shifts right on desktop to make room for sidebar */}
      <div className="sidebar-main-content flex-1 flex flex-col items-center" style={{ width: '100%' }}>
        <div className="app-shell w-full" id="main-content">
          <AnimatePresence>
            {showXpBurst && (
              <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.8 }}
                animate={{ opacity: 1, y: -10, scale: 1 }}
                exit={{ opacity: 0, y: -40, scale: 0.8 }}
                className="fixed top-20 left-1/2 z-[100] pointer-events-none"
                style={{ transform: 'translateX(-50%)' }}
              >
                <div className="glass-card-purple rounded-2xl px-5 py-3 flex items-center gap-2 glow-purple">
                  <span className="text-xl">⚡</span>
                  <span className="text-gradient" style={{ fontWeight: 700, fontSize: '1.1rem' }}>
                    +{lastXpGain} XP
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {navPending && (
            <div className="fixed top-3 right-3 z-50 flex items-center gap-2 rounded-xl px-3 py-2 glass-card" aria-live="polite">
              <Loader2 size={14} className="animate-spin" style={{ color: 'var(--cp-accent)' }} />
              <span style={{ color: 'var(--cp-text-muted)', fontSize: '0.75rem' }}>Loading…</span>
            </div>
          )}

          {!isMentor && (
            <motion.button
              type="button"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 1, type: 'spring' }}
              onClick={() => handleNavigate('/app/mentor')}
              className="fixed z-40 glow-purple nav-bottom-mobile"
              aria-label="Open AI career mentor"
              style={{
                bottom: '90px',
                right: 'clamp(1rem, 3vw, 2rem)',
                width: '48px',
                height: '48px',
                borderRadius: 'var(--cp-radius-md)',
                background: 'var(--cp-accent)',
                border: '1px solid var(--cp-border)',
                boxShadow: 'var(--cp-elevation-3)',
                cursor: 'pointer',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.3rem',
              }}
            >
              🤖
            </motion.button>
          )}

          <div className="app-content">{children}</div>

          <nav className="nav-bottom nav-bottom-mobile fixed bottom-0 left-0 w-full z-50" aria-label="Primary">
            <div className="app-page flex items-center justify-around px-2 py-2">
              {appNavItems.map(({ path, icon: Icon, label }) => {
                const isActive = pathname === path || pathname.startsWith(`${path}/`);
                const pending = navPending === path;
                return (
                  <button
                    key={path}
                    type="button"
                    onClick={() => handleNavigate(path)}
                    onMouseEnter={() => router.prefetch(path)}
                    onFocus={() => router.prefetch(path)}
                    disabled={Boolean(navPending)}
                    aria-current={isActive ? 'page' : undefined}
                    className="flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all duration-200 relative disabled:opacity-60"
                    style={{
                      background: isActive ? 'var(--cp-accent-bg)' : 'transparent',
                      color: isActive ? 'var(--cp-accent-light)' : 'var(--cp-text-muted)',
                    }}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute inset-0 rounded-2xl"
                        style={{ background: 'var(--cp-accent-bg)', border: '1px solid var(--cp-border-accent)' }}
                      />
                    )}
                    {pending ? <Loader2 size={20} className="animate-spin relative z-10" /> : <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} className="relative z-10" />}
                    <span className="relative z-10" style={{ fontSize: '10px', fontWeight: isActive ? 600 : 400 }}>{label}</span>
                  </button>
                );
              })}
            </div>
          </nav>
        </div>
      </div>
    </div>
  );
}
