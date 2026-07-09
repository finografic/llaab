import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { VaultGitStatusResponse } from '@llaab/schemas';

import { apiGet } from 'lib/api-client';
import { INGEST_FORM_RESET_EVENT } from 'lib/ingest-form-events';

import { QUERY_KEYS } from './index';

/**
 * Nested vault repo `git status`. Refetched explicitly on two signals (no polling):
 * - the ingest-form-reset event, fired after an ingest run completes
 * - any mutation anywhere in the app succeeding — almost every mutation here can touch files
 * under vault/ (consolidate, clean, promote, discard, ...), and new ones are easy to forget to
 * wire up individually, so this stays correct without each mutation having to know about it.
 */
export function useVaultGitStatus() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEYS.vault.gitStatus(),
    queryFn: () => apiGet<VaultGitStatusResponse>('/api/vault/git/status'),
  });

  useEffect(() => {
    const invalidate = () => void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vault.gitStatus() });

    window.addEventListener(INGEST_FORM_RESET_EVENT, invalidate);

    const unsubscribe = queryClient.getMutationCache().subscribe((event) => {
      if (event.type === 'updated' && event.mutation.state.status === 'success') {
        invalidate();
      }
    });

    return () => {
      window.removeEventListener(INGEST_FORM_RESET_EVENT, invalidate);
      unsubscribe();
    };
  }, [queryClient]);

  return query;
}
