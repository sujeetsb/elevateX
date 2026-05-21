'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { BrandLogo } from '@/components/BrandLogo';

const navLinks = [
  { href: '#features', label: 'Features' },
  { href: '#career-paths', label: 'Career Paths' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#how-it-works', label: 'How it Works' },
];

interface LandingNavbarProps {
  onSignIn: () => void;
  onGetStarted: () => void;
}

export function LandingNavbar({ onSignIn, onGetStarted }: LandingNavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-200"
      style={{
        background: scrolled
          ? 'color-mix(in srgb, var(--cp-surface-1) 88%, transparent)'
          : 'transparent',
        backdropFilter: scrolled ? 'blur(16px) saturate(1.2)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(16px) saturate(1.2)' : 'none',
        borderBottom: scrolled ? '1px solid var(--cp-border-subtle)' : '1px solid transparent',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        <a href="#" className="flex items-center gap-2.5 shrink-0">
          <BrandLogo size={36} nameClassName="text-lg" />
        </a>

        <nav className="hidden md:flex items-center gap-6" aria-label="Main">
          {navLinks.map(link => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm text-[var(--cp-text-muted)] hover:text-[var(--cp-text-primary)] transition-colors"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onSignIn}>
            Sign In
          </Button>
          <Button size="sm" onClick={onGetStarted}>
            Get Started
          </Button>
        </div>

        <button
          type="button"
          className="md:hidden p-2 rounded-[var(--cp-radius-md)] text-[var(--cp-text-muted)] border border-[var(--cp-border)]"
          onClick={() => setMobileOpen(v => !v)}
          aria-expanded={mobileOpen}
          aria-label="Toggle menu"
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden border-t border-[var(--cp-border-subtle)] bg-[var(--cp-surface-1)] px-4 py-4 space-y-3">
          {navLinks.map(link => (
            <a
              key={link.href}
              href={link.href}
              className="block text-sm text-[var(--cp-text-secondary)] py-1"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </a>
          ))}
          <div className="flex flex-col gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => { setMobileOpen(false); onSignIn(); }}>
              Sign In
            </Button>
            <Button size="sm" onClick={() => { setMobileOpen(false); onGetStarted(); }}>
              Get Started
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
