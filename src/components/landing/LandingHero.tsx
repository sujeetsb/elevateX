'use client';

import { motion } from 'motion/react';
import { ArrowRight, BarChart3, Play, Sparkles, Star, Users, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LandingHeroProps {
  onGetStarted: () => void;
  onSeeDemo: () => void;
}

export function LandingHero({ onGetStarted, onSeeDemo }: LandingHeroProps) {
  return (
    <section className="section-pad pt-28 pb-16 sm:pt-32 sm:pb-20 relative overflow-hidden">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-6 text-xs font-medium border border-[var(--cp-border-accent)] bg-[var(--cp-accent-bg)] text-[var(--cp-accent-light)]">
              <Sparkles size={14} aria-hidden />
              AI-powered career guidance
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.25rem] font-bold leading-[1.1] tracking-tight text-[var(--cp-text-primary)] mb-5">
              Accelerate Your Career with{' '}
              <span className="text-gradient">AI</span>
            </h1>

            <p className="text-lg text-[var(--cp-text-muted)] max-w-xl mb-8 leading-relaxed">
              Analyze your resume, improve ATS score, discover learning paths, and get personalized jobs.
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mb-10">
              <Button size="lg" className="gap-2" onClick={onGetStarted}>
                Get Started
                <ArrowRight size={18} aria-hidden />
              </Button>
              <Button size="lg" variant="outline" className="gap-2" onClick={onSeeDemo}>
                <Play size={18} aria-hidden />
                See Demo
              </Button>
            </div>

            <div className="flex flex-wrap gap-6 sm:gap-8">
              {[
                { icon: Users, value: '50K+', label: 'Users' },
                { icon: Star, value: '4.9', label: 'Rating' },
                { icon: Zap, value: '2.1M', label: 'XP Earned' },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-[var(--cp-radius-md)] flex items-center justify-center bg-[var(--cp-surface-2)] border border-[var(--cp-border-subtle)]">
                    <Icon size={16} className="text-[var(--cp-accent-light)]" aria-hidden />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-[var(--cp-text-primary)] leading-none">{value}</p>
                    <p className="text-xs text-[var(--cp-text-faint)] mt-0.5">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
            className="relative"
          >
            <div className="glass-card p-5 sm:p-6 shadow-[var(--cp-elevation-3)]">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-[var(--cp-text-primary)]">Career Roadmap</p>
                  <p className="text-xs text-[var(--cp-text-faint)]">Senior Frontend Engineer</p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-[var(--cp-accent-bg)] text-[var(--cp-accent-light)] border border-[var(--cp-border-accent)]">
                  78% match
                </span>
              </div>

              <div className="space-y-3 mb-5">
                {[
                  { label: 'React & TypeScript', pct: 92 },
                  { label: 'System Design', pct: 68 },
                  { label: 'Leadership', pct: 54 },
                ].map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-[var(--cp-text-secondary)]">{item.label}</span>
                      <span className="text-[var(--cp-text-muted)]">{item.pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-[var(--cp-surface-2)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary transition-all"
                        style={{ width: `${item.pct}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[var(--cp-radius-lg)] p-3 bg-[var(--cp-surface-2)] border border-[var(--cp-border-subtle)]">
                  <BarChart3 size={16} className="text-[var(--cp-accent-light)] mb-2" aria-hidden />
                  <p className="text-xs text-[var(--cp-text-faint)]">ATS Score</p>
                  <p className="text-xl font-bold text-[var(--cp-text-primary)]">87</p>
                </div>
                <div className="rounded-[var(--cp-radius-lg)] p-3 bg-[var(--cp-surface-2)] border border-[var(--cp-border-subtle)]">
                  <Sparkles size={16} className="text-[var(--cp-accent-light)] mb-2" aria-hidden />
                  <p className="text-xs text-[var(--cp-text-faint)]">XP This Week</p>
                  <p className="text-xl font-bold text-[var(--cp-text-primary)]">+420</p>
                </div>
              </div>
            </div>

            <div
              className="absolute -z-10 -top-8 -right-8 w-48 h-48 rounded-full blur-3xl opacity-40"
              style={{ background: 'var(--cp-accent)' }}
              aria-hidden
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
