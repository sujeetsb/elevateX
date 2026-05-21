import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: `${APP_NAME} terms of service.`,
};

export default function TermsPage() {
  return (
    <div className="aurora-bg min-h-screen" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-[var(--cp-text-muted)] hover:text-[var(--cp-text-primary)]">
          ← Back to home
        </Link>
        <h1 className="text-3xl font-bold text-[var(--cp-text-primary)] mt-6 mb-4">Terms of Service</h1>
        <p className="text-[var(--cp-text-muted)] leading-relaxed mb-4">
          By using {APP_NAME}, you agree to use the platform for lawful career development purposes.
          AI-generated recommendations are advisory and do not guarantee employment outcomes.
        </p>
        <p className="text-[var(--cp-text-muted)] leading-relaxed mb-4">
          You retain ownership of content you upload. {APP_NAME} grants you a license to use generated
          insights for personal career purposes. We may update these terms; continued use constitutes acceptance.
        </p>
        <p className="text-sm text-[var(--cp-text-faint)]">Last updated: May 2026</p>
      </div>
    </div>
  );
}
