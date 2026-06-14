import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS as VAULT_KEYS } from 'queries/vault';
import type { CanonicalIdeaNode, TranscriptNode } from '@llaab/schemas';

import { promoteCanonicalIdea } from 'lib/api';

export interface PromoteCanonicalIdeaResult {
  success: boolean;
  canonicalIdea: CanonicalIdeaNode;
  transcript: TranscriptNode;
  error?: string;
}

async function promote(transcriptId: string, candidateId: string): Promise<PromoteCanonicalIdeaResult> {
  const res = await promoteCanonicalIdea(transcriptId, candidateId);
  const json = (await res.json()) as PromoteCanonicalIdeaResult;

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Failed to promote idea to canonical.');
  }

  return json;
}

export function usePromoteCanonicalIdea() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ transcriptId, candidateId }: { transcriptId: string; candidateId: string }) =>
      promote(transcriptId, candidateId),
    onSuccess: (_data, { transcriptId }) => {
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.nodes('canonical-idea') });
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.node(transcriptId) });
    },
  });
}
