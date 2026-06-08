import { QueryClientProvider as TanStackQueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { queryClient } from './queryClient';

/**
 * Wraps a React island in the shared TanStack Query client.
 *
 * Nest this directly around any island root that uses `queries/*` hooks — e.g.
 * `<QueryClientProvider client:load><IngestForm /></QueryClientProvider>` in an
 * `.astro` page — so every island reads from and invalidates the same cache.
 */
export function QueryClientProvider({ children }: { children: ReactNode }) {
  return <TanStackQueryClientProvider client={queryClient}>{children}</TanStackQueryClientProvider>;
}
