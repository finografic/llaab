import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS as VAULT_KEYS } from 'queries/vault';

import { resolveCanonicalIdeaConflict } from 'lib/api';
import type { ResolveCanonicalIdeaConflictPayload } from 'lib/api';

export interface ResolveCanonicalIdeaConflictResult {
  success: boolean;
  kept: 'existing' | 'incoming';
  deletedCount: number;
  error?: string;
}

async function resolve(
  transcriptId: string,
  payload: ResolveCanonicalIdeaConflictPayload,
): Promise<ResolveCanonicalIdeaConflictResult> {
  const res = await resolveCanonicalIdeaConflict(transcriptId, payload);
  const json = (await res.json()) as ResolveCanonicalIdeaConflictResult;

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Failed to resolve the canonical idea conflict.');
  }

  return json;
}

/** Keep exactly one canonical-idea set after a re-consolidation produced a conflicting second one. */
export function useResolveCanonicalIdeaConflict() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      transcriptId,
      payload,
    }: {
      transcriptId: string;
      payload: ResolveCanonicalIdeaConflictPayload;
    }) => resolve(transcriptId, payload),
    onSuccess: (_data, { transcriptId }) => {
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.nodes('canonical-idea') });
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.node(transcriptId) });
    },
  });
}
