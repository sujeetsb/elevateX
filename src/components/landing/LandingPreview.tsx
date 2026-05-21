'use client';

import { BarChart3, Briefcase, MessageSquare, Network } from 'lucide-react';
import { APP_DOMAIN, APP_NAME } from '@/lib/brand';

const previews = [
  {
    icon: BarChart3,
    title: 'ATS Dashboard',
    description: 'Score breakdown, keyword gaps, and actionable fixes.',
    bars: [88, 72, 65, 91],
  },
  {
    icon: Network,
    title: 'Career Graph',
    description: 'Visual skill tree and role progression paths.',
    bars: [95, 80, 58, 42],
  },
  {
    icon: Briefcase,
    title: 'Job Match',
    description: 'AI-ranked openings matched to your profile.',
    bars: [92, 85, 78, 71],
  },
  {
    icon: MessageSquare,
    title: 'Chatbot',
    description: 'Ask anything about interviews, salary, or growth.',
    bars: [100, 100, 100, 100],
  },
];

function BrowserFrame({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <div className="rounded-[var(--cp-radius-xl)] overflow-hidden border border-[var(--cp-border-strong)] shadow-[var(--cp-elevation-3)] bg-[var(--cp-surface-1)]">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--cp-border-subtle)] bg-[var(--cp-surface-2)]">
        <div className="flex gap-1.5" aria-hidden>
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--cp-danger)] opacity-70" />
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--cp-warning)] opacity-70" />
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--cp-success)] opacity-70" />
        </div>
        <span className="text-xs text-[var(--cp-text-faint)] ml-2 truncate">{title}</span>
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  );
}

export function LandingPreview() {
  return (
    <section id="preview" className="section-pad bg-[var(--cp-surface-0)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--cp-text-primary)] mb-3">
            See {APP_NAME} in action
          </h2>
          <p className="text-[var(--cp-text-muted)]">
            Dashboard previews built for clarity — track progress at a glance.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 gap-5 lg:gap-6">
          {previews.map(preview => (
            <BrowserFrame key={preview.title} title={`app.${APP_DOMAIN} — ${preview.title}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-[var(--cp-radius-md)] flex items-center justify-center bg-[var(--cp-accent-bg)] border border-[var(--cp-border-accent)]">
                  <preview.icon size={18} className="text-[var(--cp-accent-light)]" aria-hidden />
                </div>
                <div>
                  <p className="font-medium text-sm text-[var(--cp-text-primary)]">{preview.title}</p>
                  <p className="text-xs text-[var(--cp-text-faint)]">{preview.description}</p>
                </div>
              </div>

              {preview.title === 'Chatbot' ? (
                <div className="space-y-2">
                  <div className="rounded-[var(--cp-radius-lg)] px-3 py-2 text-xs bg-[var(--cp-surface-2)] text-[var(--cp-text-muted)] max-w-[85%]">
                    How do I negotiate a senior offer?
                  </div>
                  <div className="rounded-[var(--cp-radius-lg)] px-3 py-2 text-xs bg-[var(--cp-accent-bg)] text-[var(--cp-accent-light)] border border-[var(--cp-border-accent)] max-w-[90%] ml-auto">
                    Research market rates, anchor high, and highlight impact metrics…
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {preview.bars.map((pct, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-[var(--cp-surface-2)] overflow-hidden">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-[var(--cp-text-faint)] w-8">{pct}%</span>
                    </div>
                  ))}
                </div>
              )}
            </BrowserFrame>
          ))}
        </div>
      </div>
    </section>
  );
}
