import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS as RUN_KEYS } from 'queries/runs';
import { QUERY_KEYS as VAULT_KEYS } from 'queries/vault';
import type { CanonicalIdeaNode, TranscriptCanonicalCoverage } from '@llaab/schemas';

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
  qualityValidation?: {
    passed: boolean;
    score: number;
    issues: Array<{ code: string; message: string }>;
  };
  error?: string;
  /** True when this transcript already had a canonical-idea set before this run. */
  conflict?: boolean;
  /** The previous set's ids — present only when `conflict` is true. */
  existingCanonicalIdeaIds?: string[];
  /** The previous set's quality score — present only when `conflict` is true. */
  existingQualityScore?: number;
  /** The coverage record this run would have written, deferred until the conflict is resolved. */
  pendingCoverage?: TranscriptCanonicalCoverage;
  llmMeta?: {
    model?: string;
    provider?: string;
    durationMs?: number;
    promptTokens?: number;
    completionTokens?: number;
  };
}

async function consolidateCanonicalIdeas(
  transcriptId: string,
  options?: { autoRetry?: boolean },
): Promise<ConsolidateCanonicalIdeasResult> {
  const res = await api.vault.transcripts[':id'].consolidate.$post({
    param: { id: transcriptId },
    ...(options?.autoRetry === false ? { query: { autoRetry: 'false' } } : {}),
  });
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
    mutationFn: ({ transcriptId, autoRetry }: { transcriptId: string; autoRetry?: boolean }) =>
      consolidateCanonicalIdeas(transcriptId, { autoRetry }),
    onMutate: () => {
      // The server creates the run node before the LLM call starts, so the Activity Monitor
      // badge/sidebar can show it as active right away instead of waiting for the next idle poll.
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.monitor() });
      window.setTimeout(
        () => void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.monitor() }),
        1000,
      );
    },
    onSettled: (_data, _error, { transcriptId }) => {
      invalidateTranscriptConsolidation(transcriptId);
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.monitor() });
    },
    onError: (_error, { transcriptId }) => {
      for (const delayMs of [30_000, 90_000, 180_000, 300_000]) {
        window.setTimeout(() => invalidateTranscriptConsolidation(transcriptId), delayMs);
      }
    },
  });
}
