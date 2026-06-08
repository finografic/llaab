import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS as RUN_KEYS } from 'queries/runs';
import type { TranscriptIdea } from './useTranscriptIdeas';

import { api } from 'lib/api';

import { QUERY_KEYS } from './index';
import { fetchExistingIdeas } from './useTranscriptIdeas';

export interface ExtractTranscriptResult {
  phase: 'success' | 'existing' | 'extractable' | 'failed';
  ideas?: TranscriptIdea[];
  error?: string;
}

/**
 * Run extraction against a saved transcript. Falls back to the existing-ideas list when the
 * server reports the extraction was already performed, so the form can render that state too.
 */
async function extractTranscript(transcriptId: string): Promise<ExtractTranscriptResult> {
  try {
    const res = await api.vault.transcripts[':id'].extract.$post({ param: { id: transcriptId } });
    const json = (await res.json()) as { success: boolean; ideas?: TranscriptIdea[]; error?: string };

    if (json.success) return { phase: 'success', ideas: json.ideas ?? [] };
    if (json.error?.includes('already exists')) {
      const ideas = await fetchExistingIdeas(transcriptId);
      return ideas.length > 0 ? { phase: 'existing', ideas } : { phase: 'extractable' };
    }

    return { phase: 'failed', error: json.error };
  } catch {
    return { phase: 'failed', error: 'Network error during extraction.' };
  }
}

/** Extract ideas from a transcript, invalidating its ideas list and the runs list on completion. */
export function useExtractTranscript() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: extractTranscript,
    onSettled: (_data, _error, transcriptId) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transcripts.ideas(transcriptId) });
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.list() });
    },
  });
}
