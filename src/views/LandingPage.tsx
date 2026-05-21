'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useGame } from '@/components/GameContext';
import { LandingAuthDialog } from '@/components/landing/LandingAuthDialog';
import { LandingNavbar } from '@/components/landing/LandingNavbar';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingFeatures } from '@/components/landing/LandingFeatures';
import { LandingHowItWorks } from '@/components/landing/LandingHowItWorks';
import { LandingPreview } from '@/components/landing/LandingPreview';
import { LandingCareerPath } from '@/components/landing/LandingCareerPath';
import { LandingTestimonials } from '@/components/landing/LandingTestimonials';
import { LandingPricing } from '@/components/landing/LandingPricing';
import { LandingFAQ } from '@/components/landing/LandingFAQ';
import { LandingCTA } from '@/components/landing/LandingCTA';
import { LandingFooter } from '@/components/landing/LandingFooter';

type AuthMode = 'login' | 'signup';

export function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, isOnboarded, isHydrating } = useGame();
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('signup');

  useEffect(() => {
    if (isHydrating || !isAuthenticated) return;
    if (isOnboarded) {
      router.replace('/app/dashboard');
    } else {
      router.replace('/onboarding');
    }
  }, [isHydrating, isAuthenticated, isOnboarded, router]);

  const openAuth = useCallback((mode: AuthMode) => {
    setAuthMode(mode);
    setAuthOpen(true);
  }, []);

  const scrollToPreview = useCallback(() => {
    document.getElementById('preview')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  if (isHydrating) {
    return (
      <div
        className="aurora-bg min-h-screen flex items-center justify-center"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        aria-busy="true"
        aria-label="Loading"
      >
        <Loader2 className="animate-spin text-[var(--cp-accent-light)]" size={32} />
      </div>
    );
  }

  if (isAuthenticated) {
    return (
      <div
        className="aurora-bg min-h-screen flex items-center justify-center"
        style={{ fontFamily: "'Space Grotesk', sans-serif" }}
        aria-busy="true"
      >
        <Loader2 className="animate-spin text-[var(--cp-accent-light)]" size={32} />
      </div>
    );
  }

  return (
    <div className="aurora-bg min-h-screen" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <LandingNavbar
        onSignIn={() => openAuth('login')}
        onGetStarted={() => openAuth('signup')}
      />

      <main>
        <LandingHero
          onGetStarted={() => openAuth('signup')}
          onSeeDemo={scrollToPreview}
        />
        <LandingFeatures />
        <LandingHowItWorks />
        <LandingPreview />
        <LandingCareerPath />
        <LandingTestimonials />
        <LandingPricing onGetStarted={() => openAuth('signup')} />
        <LandingFAQ />
        <LandingCTA onGetStarted={() => openAuth('signup')} />
      </main>

      <LandingFooter />

      <LandingAuthDialog
        open={authOpen}
        onOpenChange={setAuthOpen}
        mode={authMode}
        onModeChange={setAuthMode}
      />
    </div>
  );
}
