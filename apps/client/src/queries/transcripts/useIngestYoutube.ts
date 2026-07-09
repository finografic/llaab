import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS as RUN_KEYS } from 'queries/runs';
import { QUERY_KEYS as VAULT_KEYS } from 'queries/vault';

import { api } from 'lib/api';

export interface IngestYoutubeInput {
  url: string;
  tags: string[];
  skipExtraction?: boolean;
}

export interface IngestYoutubeResult {
  success: boolean;
  result?: { id: string; path: string; reused?: boolean };
  extraction?: { ideaCount: number; summary: string } | null;
  extractionError?: string | null;
  error?: string;
}

async function ingestYoutube(input: IngestYoutubeInput): Promise<IngestYoutubeResult> {
  const res = await api.ingest.youtube.$post({ json: input });
  return (await res.json());
}

/** Ingest a YouTube URL into a transcript node; refresh runs + vault joins once settled. */
export function useIngestYoutube() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ingestYoutube,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.list() });
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.monitor() });
      // New channels/transcripts must refresh so RunsTable Author (sourcesById join) updates in place
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.nodes('source') });
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.nodes('transcript') });
    },
  });
}
