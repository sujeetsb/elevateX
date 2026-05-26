'use client';

import { motion } from 'motion/react';

const features = [
  { emoji: '📄', title: 'AI Resume Analysis', description: 'ATS scoring, keyword gaps, and instant optimization tips' },
  { emoji: '🗺', title: 'Career Paths', description: 'Personalized AI roadmap from your current role to your target' },
  { emoji: '💰', title: 'Salary Intelligence', description: 'Location-aware pay benchmarks, projections & currency support' },
  { emoji: '📚', title: 'AI Courses', description: 'Generate and complete skill-gap courses tailored to you' },
  { emoji: '🧠', title: 'AI Career Chatbot', description: '24/7 mentor for goals, interviews, and career decisions' },
  { emoji: '💼', title: 'Smart Job Match', description: 'AI-ranked roles with match scores and one-click apply (PRO)' },
  { emoji: '🎮', title: 'Gamification', description: 'Earn XP, streaks, and badges as you grow your career' },
  { emoji: '✍', title: 'Cover Letters', description: 'PRO: tailored cover letters generated in seconds' },
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
            From resume analysis to job applications — one AI-powered platform for your entire career journey.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
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
