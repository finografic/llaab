import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS as RUN_KEYS } from 'queries/runs';
import { QUERY_KEYS as VAULT_KEYS } from 'queries/vault';

import { api } from 'lib/api';

export interface IngestPodcastInput {
  url: string;
  tags: string[];
  skipExtraction?: boolean;
}

export interface IngestPodcastResult {
  success: boolean;
  result?: { id: string; path: string; reused?: boolean };
  extraction?: { ideaCount: number; summary: string } | null;
  extractionError?: string | null;
  error?: string;
}

async function ingestPodcast(input: IngestPodcastInput): Promise<IngestPodcastResult> {
  const res = await api.ingest.podcast.$post({ json: input });
  return await res.json();
}

/** Ingest a Pocket Casts episode URL into a transcript node; refresh runs + vault joins once settled. */
export function useIngestPodcast() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ingestPodcast,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.list() });
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.monitor() });
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.nodes('source') });
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.nodes('transcript') });
    },
  });
}
