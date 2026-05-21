'use client';

import { ArrowDown } from 'lucide-react';

const nodes = [
  { title: 'Frontend Dev', subtitle: 'React · CSS · JS', active: false },
  { title: 'Senior Dev', subtitle: 'System design · Mentoring', active: true },
  { title: 'Lead Engineer', subtitle: 'Architecture · Team lead', active: false },
  { title: 'Architect', subtitle: 'Strategy · Platform', active: false },
];

export function LandingCareerPath() {
  return (
    <section id="career-paths" className="section-pad">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--cp-text-primary)] mb-3">
            Your learning path, visualized
          </h2>
          <p className="text-[var(--cp-text-muted)]">
            Interactive career graphs show where you are and what to learn next.
          </p>
        </div>

        <div className="glass-card p-6 sm:p-8 max-w-md mx-auto shadow-[var(--cp-elevation-2)]">
          <div className="flex flex-col items-center">
            {nodes.map((node, i) => (
              <div key={node.title} className="flex flex-col items-center w-full">
                <div
                  className="w-full max-w-[280px] rounded-[var(--cp-radius-lg)] px-4 py-3 border text-center transition-all"
                  style={{
                    background: node.active ? 'var(--cp-accent-bg)' : 'var(--cp-surface-2)',
                    borderColor: node.active ? 'var(--cp-border-accent)' : 'var(--cp-border-subtle)',
                    boxShadow: node.active ? 'var(--cp-elevation-1)' : 'none',
                  }}
                >
                  <p
                    className="font-semibold text-sm"
                    style={{ color: node.active ? 'var(--cp-accent-light)' : 'var(--cp-text-primary)' }}
                  >
                    {node.title}
                  </p>
                  <p className="text-xs text-[var(--cp-text-faint)] mt-0.5">{node.subtitle}</p>
                  {node.active && (
                    <span className="inline-block mt-2 text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/20 text-[var(--cp-accent-light)]">
                      Current focus
                    </span>
                  )}
                </div>

                {i < nodes.length - 1 && (
                  <div className="flex flex-col items-center py-2 text-[var(--cp-text-faint)]" aria-hidden>
                    <div className="w-px h-4 bg-[var(--cp-border)]" />
                    <ArrowDown size={16} />
                    <div className="w-px h-4 bg-[var(--cp-border)]" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
