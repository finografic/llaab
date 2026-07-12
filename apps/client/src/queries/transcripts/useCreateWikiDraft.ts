import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS as RUN_KEYS } from 'queries/runs';
import { QUERY_KEYS as VAULT_KEYS } from 'queries/vault';

import { api } from 'lib/api';

import { QUERY_KEYS } from './index';

export interface CreateWikiDraftInput {
  transcriptId: string;
  canonicalIdeaIds: string[];
  suggestedTitle?: string;
}

export interface CreateWikiDraftResult {
  success: true;
  draftId: string;
  runId: string;
  qualityScore: number;
  warnings: string[];
}

async function createWikiDraft(input: CreateWikiDraftInput): Promise<CreateWikiDraftResult> {
  const response = await api.vault.transcripts[':id']['wiki-drafts'].$post({
    param: { id: input.transcriptId },
    json: {
      canonical_idea_ids: input.canonicalIdeaIds,
      ...(input.suggestedTitle ? { suggested_title: input.suggestedTitle } : {}),
    },
  });
  const result = (await response.json()) as CreateWikiDraftResult | { error?: string };
  if (!response.ok || !('success' in result) || !result.success) {
    throw new Error(
      'error' in result ? (result.error ?? 'Wiki compilation failed.') : 'Wiki compilation failed.',
    );
  }
  return result;
}

export function useCreateWikiDraft() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createWikiDraft,
    onMutate: () => {
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.monitor() });
    },
    onSettled: (_result, _error, input) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transcripts.all });
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.nodes('wiki-draft') });
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.node(input.transcriptId) });
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.monitor() });
    },
  });
}
