'use client';

import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LandingPricingProps {
  onGetStarted: () => void;
}

const plans = [
  {
    name: 'FREE',
    price: '$0',
    period: 'forever',
    highlighted: false,
    features: [
      'AI Resume Analysis & ATS score',
      'Career path roadmap',
      'Basic salary insights',
      '2 AI-generated courses',
      'Limited chatbot messages',
    ],
    cta: 'Get Started Free',
    ctaVariant: 'outline' as const,
  },
  {
    name: 'PRO',
    price: '$19',
    period: '/month',
    highlighted: true,
    features: [
      'Unlimited AI courses',
      'Job apply & cover letters',
      'Premium salary charts & projections',
      'Advanced AI mentor (unlimited)',
      'Priority course generation',
    ],
    cta: 'Start PRO Trial',
    ctaVariant: 'default' as const,
  },
];

export function LandingPricing({ onGetStarted }: LandingPricingProps) {
  return (
    <section id="pricing" className="section-pad">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--cp-text-primary)] mb-3">
            Simple, transparent pricing
          </h2>
          <p className="text-[var(--cp-text-muted)]">
            Start free with resume analysis and career paths. Upgrade to PRO when you&apos;re ready to apply, earn more, and unlock advanced AI.
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-5 max-w-3xl mx-auto">
          {plans.map(plan => (
            <div
              key={plan.name}
              className="glass-card p-6 sm:p-8 flex flex-col relative transition-all"
              style={{
                borderColor: plan.highlighted ? 'var(--cp-border-accent)' : undefined,
                boxShadow: plan.highlighted ? 'var(--cp-elevation-3)' : undefined,
              }}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-medium px-3 py-1 rounded-full bg-primary text-primary-foreground">
                  Most popular
                </span>
              )}

              <p className="text-sm font-semibold tracking-wide text-[var(--cp-text-muted)] mb-2">{plan.name}</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold text-[var(--cp-text-primary)]">{plan.price}</span>
                <span className="text-sm text-[var(--cp-text-faint)]">{plan.period}</span>
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map(feature => (
                  <li key={feature} className="flex items-center gap-2 text-sm text-[var(--cp-text-secondary)]">
                    <Check size={16} className="text-[var(--cp-accent-light)] shrink-0" aria-hidden />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button variant={plan.ctaVariant} className="w-full" onClick={onGetStarted}>
                {plan.cta}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
