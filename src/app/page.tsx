import type { Metadata } from 'next';
import { LandingPage } from '@/views/LandingPage';
import { APP_NAME, APP_TAGLINE } from '@/lib/brand';

export const metadata: Metadata = {
  title: `${APP_NAME} — Accelerate Your Career with AI`,
  description:
    'Analyze your resume, improve ATS score, discover learning paths, and get personalized job matches with AI-powered career guidance.',
  openGraph: {
    title: `${APP_NAME} — Accelerate Your Career with AI`,
    description: APP_TAGLINE,
    type: 'website',
    siteName: APP_NAME,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${APP_NAME} — Accelerate Your Career with AI`,
    description: APP_TAGLINE,
  },
};

export default function HomePage() {
  return <LandingPage />;
}
