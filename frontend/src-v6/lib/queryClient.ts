/**
 * Shared QueryClient configuration for Web and PWA entry points.
 * Ensures identical caching, retry, and staleTime behavior across both apps.
 */

import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: (failureCount, error: unknown) => {
        if (failureCount >= 2) return false;
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status && status < 500) return false; // No retry on 4xx
        return true; // Retry 5xx and network errors
      },
      refetchOnWindowFocus: false,
    },
  },
});
