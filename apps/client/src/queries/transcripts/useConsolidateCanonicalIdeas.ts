import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS as VAULT_KEYS } from 'queries/vault';
import type { CanonicalIdeaNode } from '@llaab/schemas';

import { api } from 'lib/api';

export interface ConsolidateCanonicalIdeasResult {
  success: boolean;
  canonicalIdeaIds: string[];
  canonicalIdeas: CanonicalIdeaNode[];
  coverageAudit?: {
    coverage: Array<{
      candidateId: string;
      canonicalIdeaIndexes: number[];
      status: 'covered' | 'omitted' | 'missed';
      reason: string;
    }>;
    missed: Array<{
      candidateId: string;
      canonicalIdeaIndexes: number[];
      status: 'missed';
      reason: string;
    }>;
    warning?: string;
  };
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

  function invalidateTranscriptConsolidation(transcriptId: string) {
    void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.nodes('canonical-idea') });
    void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.node(transcriptId) });
  }

  return useMutation({
    mutationFn: consolidateCanonicalIdeas,
    onSettled: (_data, _error, transcriptId) => {
      invalidateTranscriptConsolidation(transcriptId);
    },
    onError: (_error, transcriptId) => {
      for (const delayMs of [30_000, 90_000, 180_000, 300_000]) {
        window.setTimeout(() => invalidateTranscriptConsolidation(transcriptId), delayMs);
      }
    },
  });
}
