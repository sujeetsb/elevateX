import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query';
import { parseApiError } from '@/lib/api/client';

let toastHandler: ((message: string) => void) | null = null;

/** Register toast handler from client Providers (avoids importing sonner in SSR). */
export function registerQueryToastHandler(handler: (message: string) => void) {
  toastHandler = handler;
}

function notifyQueryError(message: string) {
  if (typeof window === 'undefined') return;
  toastHandler?.(message);
}

/** Shared query client — used by Providers and sign-out cleanup. */
export function createAppQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (query.meta?.suppressErrorToast) return;
        const msg = error instanceof Error ? error.message : parseApiError(error, 'Could not load data');
        notifyQueryError(msg);
      },
    }),
    mutationCache: new MutationCache({
      onError: (err: unknown) => {
        const msg = err instanceof Error ? err.message : parseApiError(err, 'Something went wrong');
        notifyQueryError(msg);
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 2 * 60_000,
        gcTime: 15 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserClient: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === 'undefined') return createAppQueryClient();
  if (!browserClient) browserClient = createAppQueryClient();
  return browserClient;
}

export function clearAppQueryCache() {
  getQueryClient().clear();
}

/**
 * Sign-out cache reset that avoids triggering noisy refetches.
 * We first cancel in-flight work, then remove cached queries/mutations.
 */
export async function resetAppQueryCacheForSignOut() {
  const qc = getQueryClient();
  await qc.cancelQueries();
  qc.removeQueries();
  qc.getMutationCache().clear();
}
