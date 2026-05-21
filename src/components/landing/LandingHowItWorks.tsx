'use client';

import { Brain, Briefcase, FileUp, LineChart } from 'lucide-react';

const steps = [
  { icon: FileUp, title: 'Upload Resume', description: 'Import PDF or paste your experience' },
  { icon: Brain, title: 'AI Analysis', description: 'Skills, gaps, and ATS scoring' },
  { icon: LineChart, title: 'Get Career Insights', description: 'Roadmap, salary, and learning paths' },
  { icon: Briefcase, title: 'Land Better Jobs', description: 'Matched roles and tailored applications' },
];

export function LandingHowItWorks() {
  return (
    <section id="how-it-works" className="section-pad">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--cp-text-primary)] mb-3">
            How it works
          </h2>
          <p className="text-[var(--cp-text-muted)]">
            Four simple steps from resume upload to your next role.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-4">
          {steps.map((step, i) => (
            <div key={step.title} className="relative flex flex-col items-center text-center">
              {i < steps.length - 1 && (
                <div
                  className="hidden lg:block absolute top-8 left-[calc(50%+2rem)] w-[calc(100%-4rem)] h-px bg-[var(--cp-border)]"
                  aria-hidden
                />
              )}

              <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 bg-[var(--cp-surface-2)] border-2 border-[var(--cp-border-accent)] shadow-[var(--cp-elevation-1)] relative z-10">
                <step.icon size={24} className="text-[var(--cp-accent-light)]" aria-hidden />
                <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
                  {i + 1}
                </span>
              </div>

              <h3 className="font-semibold text-[var(--cp-text-primary)] mb-1">{step.title}</h3>
              <p className="text-sm text-[var(--cp-text-muted)] max-w-[200px]">{step.description}</p>

              {i < steps.length - 1 && (
                <div className="lg:hidden text-[var(--cp-text-faint)] mt-4 mb-2" aria-hidden>
                  ↓
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
