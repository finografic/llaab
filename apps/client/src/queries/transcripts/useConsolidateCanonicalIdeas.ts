import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS as VAULT_KEYS } from 'queries/vault';
import type { CanonicalIdeaNode } from '@llaab/schemas';

import { api } from 'lib/api';

export interface ConsolidateCanonicalIdeasResult {
  success: boolean;
  canonicalIdeaIds: string[];
  canonicalIdeas: CanonicalIdeaNode[];
  error?: string;
}

async function consolidateCanonicalIdeas(transcriptId: string): Promise<ConsolidateCanonicalIdeasResult> {
  const res = await api.vault.transcripts[':id'].consolidate.$post({ param: { id: transcriptId } });
  const json = (await res.json()) as ConsolidateCanonicalIdeasResult;

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Canonical idea consolidation failed.');
  }

  return json;
}

export function useConsolidateCanonicalIdeas() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: consolidateCanonicalIdeas,
    onSettled: (_data, _error, transcriptId) => {
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.nodes('canonical-idea') });
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.node(transcriptId) });
    },
  });
}
