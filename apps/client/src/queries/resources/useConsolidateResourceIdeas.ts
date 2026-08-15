import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS as RUN_KEYS } from 'queries/runs';
import { QUERY_KEYS as VAULT_KEYS } from 'queries/vault';
import type { ConsolidateCanonicalIdeasResult } from 'queries/transcripts';

async function consolidateResourceIdeas(
  resourceId: string,
  options?: { autoRetry?: boolean },
): Promise<ConsolidateCanonicalIdeasResult> {
  const query = options?.autoRetry === false ? '?autoRetry=false' : '';
  const response = await fetch(`/api/vault/resources/${resourceId}/consolidate${query}`, {
    method: 'POST',
  });
  const json = (await response.json()) as ConsolidateCanonicalIdeasResult;

  if (!response.ok || !json.success) {
    throw new Error(json.error ?? 'Canonical idea consolidation failed.');
  }

  return json;
}

export function useConsolidateResourceIdeas() {
  const queryClient = useQueryClient();

  function invalidateResourceConsolidation(resourceId: string) {
    void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.nodes('canonical-idea') });
    void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.node(resourceId) });
  }

  return useMutation({
    mutationFn: ({ resourceId, autoRetry }: { resourceId: string; autoRetry?: boolean }) =>
      consolidateResourceIdeas(resourceId, { autoRetry }),
    onMutate: () => {
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.monitor() });
      window.setTimeout(
        () => void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.monitor() }),
        1000,
      );
    },
    onSettled: (_data, _error, { resourceId }) => {
      invalidateResourceConsolidation(resourceId);
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.monitor() });
    },
    onError: (_error, { resourceId }) => {
      for (const delayMs of [30_000, 90_000, 180_000, 300_000]) {
        window.setTimeout(() => invalidateResourceConsolidation(resourceId), delayMs);
      }
    },
  });
}
