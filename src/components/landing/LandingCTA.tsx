'use client';

import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LandingCTAProps {
  onGetStarted: () => void;
}

export function LandingCTA({ onGetStarted }: LandingCTAProps) {
  return (
    <section className="section-pad">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="glass-card p-10 sm:p-14 text-center shadow-[var(--cp-elevation-3)] border-[var(--cp-border-accent)]">
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--cp-text-primary)] mb-4">
            Ready to grow your career?
          </h2>
          <p className="text-[var(--cp-text-muted)] max-w-lg mx-auto mb-8">
            Join thousands of professionals using AI to land better roles, faster.
          </p>
          <Button size="lg" className="gap-2" onClick={onGetStarted}>
            Get Started Free
            <ArrowRight size={18} aria-hidden />
          </Button>
        </div>
      </div>
    </section>
  );
}
