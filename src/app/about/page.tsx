import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_AUTHOR, APP_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'About',
  description: `Learn about ${APP_NAME} — AI-powered career guidance platform.`,
};

export default function AboutPage() {
  return (
    <div className="aurora-bg flex-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-[var(--cp-text-muted)] hover:text-[var(--cp-text-primary)]">
          ← Back to home
        </Link>
        <h1 className="text-3xl font-bold text-[var(--cp-text-primary)] mt-6 mb-4">About {APP_NAME}</h1>
        <p className="text-[var(--cp-text-muted)] leading-relaxed mb-4">
          {APP_NAME} is an AI-first career guidance platform that helps professionals analyze resumes,
          improve ATS scores, discover learning paths, and find personalized job matches.
        </p>
        <p className="text-[var(--cp-text-muted)] leading-relaxed">
          Our mission is to elevate every career through intelligent coaching, gamified learning,
          and data-driven insights — so you can land better roles, faster.
        </p>
        <p className="text-sm text-[var(--cp-text-faint)] mt-8">
          {APP_NAME} is created by {APP_AUTHOR}.
        </p>
      </div>
    </div>
  );
}
