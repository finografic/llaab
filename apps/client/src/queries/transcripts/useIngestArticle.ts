import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS as RUN_KEYS } from 'queries/runs';
import { QUERY_KEYS as VAULT_KEYS } from 'queries/vault';

import { api } from 'lib/api';

export interface IngestArticleInput {
  url: string;
  tags: string[];
  title?: string;
  skipExtraction?: boolean;
  inboxCaptureId?: string;
}

export interface IngestArticleResult {
  success: boolean;
  result?: {
    id: string;
    path: string;
    type?: string;
    title?: string;
    canonicalUrl?: string;
    sourceId?: string;
    reused?: boolean;
  };
  extraction?: { ideaCount: number; summary: string } | null;
  extractionError?: string | null;
  error?: string;
}

async function ingestArticle(input: IngestArticleInput): Promise<IngestArticleResult> {
  const res = await api.ingest.article.$post({ json: input });
  return await res.json();
}

/**
 * Ingest one public article URL into a resource node; refresh runs + vault joins once settled.
 *
 * Articles land as resources with a publication source, so the invalidated node families differ
 * from the transcript ingest hooks.
 */
export function useIngestArticle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ingestArticle,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.list() });
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.monitor() });
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.nodes('source') });
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.nodes('resource') });
    },
  });
}
