'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { SessionProvider } from 'next-auth/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GameProvider } from '@/components/GameContext';
import { ThemeProvider } from '@/components/ThemeContext';
import { Toaster } from '@/components/ui/sonner';
import { getQueryClient } from '@/lib/query-client';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => getQueryClient());

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SessionProvider refetchOnWindowFocus={false}>
          <QueryClientProvider client={queryClient}>
            <GameProvider>{children}</GameProvider>
            <Toaster richColors closeButton position="top-center" />
            {process.env.NODE_ENV === 'development' ? (
              <ReactQueryDevtools initialIsOpen={false} />
            ) : null}
          </QueryClientProvider>
        </SessionProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
