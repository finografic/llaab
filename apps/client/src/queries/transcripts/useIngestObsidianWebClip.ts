import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS as RUN_KEYS } from 'queries/runs';
import { QUERY_KEYS as VAULT_KEYS } from 'queries/vault';
import type { IngestArticleResult } from './useIngestArticle';

import { api } from 'lib/api';

export interface IngestObsidianWebClipInput {
  markdown: string;
  tags?: string[];
  skipExtraction?: boolean;
}

export type IngestObsidianWebClipResult = IngestArticleResult;

async function ingestObsidianWebClip(
  input: IngestObsidianWebClipInput,
): Promise<IngestObsidianWebClipResult> {
  const res = await api.ingest['obsidian-web-clip'].$post({ json: input });
  return await res.json();
}

/** Ingest pasted Obsidian Web Clipper Markdown as an article/resource node. */
export function useIngestObsidianWebClip() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ingestObsidianWebClip,
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.list() });
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.monitor() });
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.nodes('source') });
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.nodes('resource') });
    },
  });
}
