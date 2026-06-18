import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { VaultGitStatusResponse } from '@llaab/schemas';

import { apiGet } from 'lib/api-client';
import { INGEST_FORM_RESET_EVENT } from 'lib/ingest-form-events';

import { QUERY_KEYS } from './index';

/** Vault-scoped `git status`, refetched explicitly after an ingest run resets the form (no polling). */
export function useVaultGitStatus() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: QUERY_KEYS.vault.gitStatus(),
    queryFn: () => apiGet<VaultGitStatusResponse>('/api/vault/git/status'),
  });

  useEffect(() => {
    const invalidate = () => void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vault.gitStatus() });
    window.addEventListener(INGEST_FORM_RESET_EVENT, invalidate);
    return () => window.removeEventListener(INGEST_FORM_RESET_EVENT, invalidate);
  }, [queryClient]);

  return query;
}
