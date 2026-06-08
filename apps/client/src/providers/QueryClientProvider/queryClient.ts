import { QueryClient } from '@tanstack/react-query';

/**
 * Singleton TanStack Query client shared across all Astro islands.
 *
 * Each `client:load`/`client:only` component mounts as an independent React root —
 * a per-component `useState(() => new QueryClient())` would give every island its own
 * cache, so invalidating a query in one island (e.g. a mutation in `IngestForm`) would
 * never refresh another (e.g. `RunsTable`). Creating the client once at module scope
 * and importing it from every `QueryClientProvider` wrapper keeps one shared cache.
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
