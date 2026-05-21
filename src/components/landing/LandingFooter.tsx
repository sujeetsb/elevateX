'use client';

import { Github, Linkedin, Twitter } from 'lucide-react';
import { BrandLogo } from '@/components/BrandLogo';
import { APP_NAME } from '@/lib/brand';

const links = [
  { href: '/about', label: 'About' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '#pricing', label: 'Pricing' },
];

const social = [
  { href: 'https://linkedin.com', icon: Linkedin, label: 'LinkedIn' },
  { href: 'https://github.com', icon: Github, label: 'GitHub' },
  { href: 'https://twitter.com', icon: Twitter, label: 'Twitter' },
];

export function LandingFooter() {
  return (
    <footer className="border-t border-[var(--cp-border-subtle)] bg-[var(--cp-surface-0)]">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
          <BrandLogo size={32} nameClassName="text-base" />

          <nav className="flex flex-wrap justify-center gap-6" aria-label="Footer">
            {links.map(link => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-[var(--cp-text-muted)] hover:text-[var(--cp-text-primary)] transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            {social.map(({ href, icon: Icon, label }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="w-9 h-9 rounded-[var(--cp-radius-md)] flex items-center justify-center border border-[var(--cp-border)] text-[var(--cp-text-muted)] hover:text-[var(--cp-text-primary)] hover:border-[var(--cp-border-accent)] transition-colors"
                aria-label={label}
              >
                <Icon size={16} />
              </a>
            ))}
          </div>
        </div>

        <p className="text-center text-xs text-[var(--cp-text-faint)] mt-8">
          © {new Date().getFullYear()} {APP_NAME}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
