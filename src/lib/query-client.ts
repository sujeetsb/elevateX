import { QueryClient } from '@tanstack/react-query';

/** Shared query client — used by Providers and sign-out cleanup. */
export function createAppQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 2 * 60_000,
        gcTime: 15 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
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
