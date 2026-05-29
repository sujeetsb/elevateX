import type { Metadata, Viewport } from 'next';
import '@uploadthing/react/styles.css';
import '@/styles/index.css';
import { CopyrightFooter } from '@/components/CopyrightFooter';
import { Providers } from './providers';
import { APP_AUTHOR, APP_NAME, APP_NAME_FULL, APP_TAGLINE, APP_URL } from '@/lib/brand';

export const metadata: Metadata = {
  title: {
    default: APP_NAME_FULL,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_TAGLINE,
  applicationName: APP_NAME,
  authors: [{ name: APP_AUTHOR, url: APP_URL }],
  creator: APP_AUTHOR,
  publisher: APP_AUTHOR,
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [{ url: '/favicon.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icon-192.svg', type: 'image/svg+xml' }],
  },
  openGraph: {
    title: APP_NAME_FULL,
    description: APP_TAGLINE,
    siteName: APP_NAME,
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#6366f1' },
    { media: '(prefers-color-scheme: dark)', color: '#6366f1' },
  ],
};

/**
 * Blocking script: runs synchronously before React hydrates so the correct
 * data-theme attribute is on <html> from the very first paint.
 * This eliminates any flash of wrong theme (FOWT) on page load / refresh.
 */
const themeScript = `(function(){try{var t=localStorage.getItem('cp-theme');if(t==='dark'||t==='light'){document.documentElement.setAttribute('data-theme',t);}else if(t==='system'||!t){var dark=window.matchMedia('(prefers-color-scheme: dark)').matches;document.documentElement.setAttribute('data-theme',dark?'dark':'light');}else{document.documentElement.setAttribute('data-theme','dark');}}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /*
     * suppressHydrationWarning: the blocking script mutates data-theme before
     * React hydrates, causing a mismatch between SSR html (no attribute) and
     * client html (attribute set). This prop silences that expected mismatch.
     */
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* eslint-disable-next-line react/no-danger */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh flex flex-col antialiased" style={{ margin: 0 }}>
        <Providers>
          <div className="cp-root-shell flex min-h-dvh w-full min-w-0 max-w-full flex-1 flex-col overflow-x-clip">
            <div className="flex min-h-0 min-w-0 w-full max-w-full flex-1 flex-col overflow-x-clip">{children}</div>
            <CopyrightFooter />
          </div>
        </Providers>
      </body>
    </html>
  );
}
