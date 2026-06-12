import { QueryClient } from '@tanstack/react-query';

/**
 * Singleton TanStack Query client shared by the Vite SPA root.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60, // 1 minute — local vault data changes frequently via ingestion/extraction
      gcTime: 1000 * 60 * 30,
    },
  },
});
