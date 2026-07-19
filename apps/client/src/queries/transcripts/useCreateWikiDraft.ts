import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS as RUN_KEYS } from 'queries/runs';
import { QUERY_KEYS as VAULT_KEYS } from 'queries/vault';
import type { KnowledgeWikiPage } from '@llaab/schemas';

import { api } from 'lib/api';

import { QUERY_KEYS } from './index';

export interface CreateWikiDraftInput {
  transcriptId: string;
  canonicalIdeaIds: string[];
  suggestedTitle?: string;
  targetWikiId?: string;
}

export interface CreateWikiDraftResult {
  success: true;
  draftId: string;
  draftIds: string[];
  draftCount: number;
  runId: string;
  runIds: string[];
  qualityScore: number;
  warnings: string[];
  wikiId: string;
  wikiIds: string[];
  wikiCount: number;
  wikis: KnowledgeWikiPage[];
  branches?: Array<{
    outcome: 'promoted-create' | 'promoted-update' | 'existing-no-op' | 'skipped' | 'failed';
    proposal_id?: string;
    draft_id?: string;
    wiki_id?: string;
    run_id?: string;
    warnings?: string[];
    reason?: string;
  }>;
}

async function createWikiDraft(input: CreateWikiDraftInput): Promise<CreateWikiDraftResult> {
  const response = await api.vault.transcripts[':id']['wiki-drafts'].$post({
    param: { id: input.transcriptId },
    json: {
      canonical_idea_ids: input.canonicalIdeaIds,
      ...(input.suggestedTitle ? { suggested_title: input.suggestedTitle } : {}),
      ...(input.targetWikiId ? { target_wiki_id: input.targetWikiId } : {}),
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
      void queryClient.invalidateQueries({ queryKey: ['knowledge', 'wikis'] });
    },
    onSettled: (_result, _error, input) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transcripts.all });
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.nodes('wiki-draft') });
      void queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.node(input.transcriptId) });
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.monitor() });
    },
  });
}
