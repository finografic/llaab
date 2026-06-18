import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS as RUN_KEYS } from 'queries/runs';
import type { VaultGitResetResponse } from '@llaab/schemas';

import { apiPost } from 'lib/api-client';

import { QUERY_KEYS } from './index';

/**
 * Discards every uncommitted change under `vault/` — both tracked modifications (git checkout)
 * and untracked files (git clean) — then invalidates broadly so any open page (transcripts,
 * runs, ideas, ...) re-fetches and reflects files that may have just been deleted from disk.
 */
export function useVaultGitReset() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiPost<VaultGitResetResponse>('/api/vault/git/reset', {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vault.all });
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.all });
    },
  });
}
