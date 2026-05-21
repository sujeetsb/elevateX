'use client';

import type { ReactNode } from 'react';
import { useState } from 'react';
import { SessionProvider } from 'next-auth/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GameProvider } from '@/components/GameContext';
import { ThemeProvider } from '@/components/ThemeContext';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60_000,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  return (
    <ErrorBoundary>
      {/*
       * ThemeProvider is the outermost wrapper so theme applies on every page
       * — including unauthenticated routes — without waiting for GameContext.
       */}
      <ThemeProvider>
        <SessionProvider>
          <QueryClientProvider client={queryClient}>
            <GameProvider>{children}</GameProvider>
            {process.env.NODE_ENV === 'development' ? (
              <ReactQueryDevtools initialIsOpen={false} />
            ) : null}
          </QueryClientProvider>
        </SessionProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
