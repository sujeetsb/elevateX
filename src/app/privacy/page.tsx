import type { Metadata } from 'next';
import Link from 'next/link';
import { APP_NAME } from '@/lib/brand';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `${APP_NAME} privacy policy.`,
};

export default function PrivacyPage() {
  return (
    <div className="aurora-bg flex-1" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link href="/" className="text-sm text-[var(--cp-text-muted)] hover:text-[var(--cp-text-primary)]">
          ← Back to home
        </Link>
        <h1 className="text-3xl font-bold text-[var(--cp-text-primary)] mt-6 mb-4">Privacy Policy</h1>
        <p className="text-[var(--cp-text-muted)] leading-relaxed mb-4">
          {APP_NAME} respects your privacy. We collect account information, resume data, and usage
          analytics to provide personalized career guidance. Your data is stored securely and is not
          sold to third parties.
        </p>
        <p className="text-[var(--cp-text-muted)] leading-relaxed mb-4">
          Resume files and profile data are used solely to generate ATS scores, career roadmaps, and
          job recommendations. You may request deletion of your account and associated data by
          contacting support.
        </p>
        <p className="text-sm text-[var(--cp-text-faint)]">Last updated: May 2026</p>
      </div>
    </div>
  );
}
