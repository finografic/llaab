import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS as RUN_KEYS } from 'queries/runs';
import { QUERY_KEYS as VAULT_KEYS } from 'queries/vault';

import { cleanCanonicalIdeaArtifacts } from 'lib/api';

export interface CleanCanonicalIdeaArtifactsResult {
  success: boolean;
  deletedCanonicalIdeaCount: number;
  deletedRunCount: number;
  error?: string;
}

async function clean(transcriptId: string): Promise<CleanCanonicalIdeaArtifactsResult> {
  const res = await cleanCanonicalIdeaArtifacts(transcriptId);
  const json = (await res.json()) as CleanCanonicalIdeaArtifactsResult;

  if (!res.ok || !json.success) {
    throw new Error(json.error ?? 'Failed to clean canonical idea artifacts.');
  }

  return json;
}

/** Deletes every canonical-idea/consolidation-run artifact for a transcript and clears its coverage. */
export function useCleanCanonicalIdeaArtifacts() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (transcriptId: string) => clean(transcriptId),
    onSuccess: (_data, transcriptId) => {
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.nodes('canonical-idea') });
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.nodes('transcript') });
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.node(transcriptId) });
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.list() });
    },
  });
}
