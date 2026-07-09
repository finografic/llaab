import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { VaultGitCommitResponse } from '@llaab/schemas';

import { apiPost } from 'lib/api-client';

import { QUERY_KEYS } from './index';

/** Commit all currently-changed files in the nested vault repo, invalidating the git status query on success. */
export function useVaultGitCommit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => apiPost<VaultGitCommitResponse>('/api/vault/git/commit', {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vault.gitStatus() });
    },
  });
}
