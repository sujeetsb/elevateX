'use client';

import type { ReactNode } from 'react';
import { useState, useEffect } from 'react';
import { SessionProvider } from 'next-auth/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { toast } from 'sonner';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { GameProvider } from '@/components/GameContext';
import { AuthRoutingGuard } from '@/components/AuthRoutingGuard';
import { ThemeProvider } from '@/components/ThemeContext';
import { Toaster } from '@/components/ui/sonner';
import { getQueryClient, registerQueryToastHandler } from '@/lib/query-client';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => getQueryClient());

  useEffect(() => {
    registerQueryToastHandler(msg => toast.error(msg));
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <SessionProvider refetchOnWindowFocus={false}>
          <QueryClientProvider client={queryClient}>
            <GameProvider>
              <AuthRoutingGuard />
              {children}
            </GameProvider>
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
