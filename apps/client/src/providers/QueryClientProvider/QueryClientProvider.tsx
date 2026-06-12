import { QueryClientProvider as TanStackQueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

import { queryClient } from './queryClient';

/**
 * Wraps the SPA root in the shared TanStack Query client.
 */
export function QueryClientProvider({ children }: { children: ReactNode }) {
  return <TanStackQueryClientProvider client={queryClient}>{children}</TanStackQueryClientProvider>;
}
