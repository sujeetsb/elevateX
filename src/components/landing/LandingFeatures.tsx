'use client';

import { motion } from 'motion/react';

const features = [
  {
    emoji: '🤖',
    title: 'AI Career Roadmap',
    description: 'Personalized path to dream role',
  },
  {
    emoji: '📄',
    title: 'ATS Optimizer',
    description: 'Improve resume score',
  },
  {
    emoji: '💼',
    title: 'Smart Job Match',
    description: 'AI job recommendations',
  },
  {
    emoji: '🎮',
    title: 'Gamified Learning',
    description: 'Earn XP and badges',
  },
  {
    emoji: '✍',
    title: 'Cover Letter Generator',
    description: 'Tailored letters in seconds',
  },
  {
    emoji: '🧠',
    title: 'Career AI Chatbot',
    description: '24/7 mentor for your goals',
  },
];

export function LandingFeatures() {
  return (
    <section id="features" className="section-pad bg-[var(--cp-surface-0)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold text-[var(--cp-text-primary)] mb-3">
            Everything you need to grow
          </h2>
          <p className="text-[var(--cp-text-muted)]">
            From resume analysis to job applications — one platform for your entire career journey.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="glass-card p-5 sm:p-6 group hover:shadow-[var(--cp-elevation-2)] hover:border-[var(--cp-border-accent)] transition-all duration-200"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-[var(--cp-radius-lg)] flex items-center justify-center shrink-0 bg-[var(--cp-accent-bg)] border border-[var(--cp-border-accent)] text-lg group-hover:scale-105 transition-transform">
                  <span aria-hidden>{feature.emoji}</span>
                </div>
                <div>
                  <h3 className="font-semibold text-[var(--cp-text-primary)] mb-1">{feature.title}</h3>
                  <p className="text-sm text-[var(--cp-text-muted)] leading-relaxed">{feature.description}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
