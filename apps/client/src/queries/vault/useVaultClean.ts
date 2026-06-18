import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS as RUN_KEYS } from 'queries/runs';

import { apiPost } from 'lib/api-client';

import { QUERY_KEYS as VAULT_KEYS } from './index';

export interface VaultCleanResult {
  success: true;
  removedCount: number;
}

/** Remove vault artifacts modified within the last N hours, invalidating the runs list on success. */
export function useVaultClean() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (hours: number) => apiPost<VaultCleanResult>('/api/vault/clean-recent', { hours }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.list() });
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.gitStatus() });
    },
  });
}
