'use client';

const testimonials = [
  {
    name: 'Priya Sharma',
    role: 'Software Engineer → Senior SDE',
    avatar: 'PS',
    quote: 'ElevateX raised my ATS score from 62 to 89 in two weeks. I landed three interviews within a month.',
  },
  {
    name: 'Marcus Lee',
    role: 'Product Manager',
    avatar: 'ML',
    quote: 'The career roadmap made my skill gaps obvious. The gamified learning kept me consistent every day.',
  },
  {
    name: 'Elena Rodriguez',
    role: 'UX Designer',
    avatar: 'ER',
    quote: 'Cover letters used to take hours. Now I tailor applications in minutes and actually enjoy the process.',
  },
];

export function LandingTestimonials() {
  return (
    <section className="section-pad bg-[var(--cp-surface-0)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--cp-text-primary)] mb-3">
            Loved by professionals
          </h2>
          <p className="text-[var(--cp-text-muted)]">
            Real stories from people who accelerated their careers with AI guidance.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4 sm:gap-5">
          {testimonials.map(t => (
            <article
              key={t.name}
              className="glass-card p-5 sm:p-6 flex flex-col hover:shadow-[var(--cp-elevation-2)] transition-shadow"
            >
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold bg-[var(--cp-accent-bg)] text-[var(--cp-accent-light)] border border-[var(--cp-border-accent)]"
                  aria-hidden
                >
                  {t.avatar}
                </div>
                <div>
                  <p className="font-medium text-sm text-[var(--cp-text-primary)]">{t.name}</p>
                  <p className="text-xs text-[var(--cp-text-faint)]">{t.role}</p>
                </div>
              </div>
              <p className="text-sm text-[var(--cp-text-muted)] leading-relaxed flex-1">
                &ldquo;{t.quote}&rdquo;
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
