import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WikiDraftNode } from '@llaab/schemas';
import type { QueryClient } from '@tanstack/react-query';

import { api } from 'lib/api';

import { QUERY_KEYS as KNOWLEDGE_KEYS } from '../knowledge/index';
import { QUERY_KEYS as VAULT_KEYS } from '../vault/index';

export const QUERY_KEYS = {
  wikiDrafts: {
    all: ['wiki-drafts'] as const,
    detail: (id: string) => [...QUERY_KEYS.wikiDrafts.all, id] as const,
  },
};

export async function invalidateWikiDraftCaches(queryClient: QueryClient, id: string): Promise<void> {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: QUERY_KEYS.wikiDrafts.detail(id) }),
    queryClient.invalidateQueries({ queryKey: VAULT_KEYS.vault.all }),
    queryClient.invalidateQueries({ queryKey: KNOWLEDGE_KEYS.knowledge.all }),
  ]);
}

export interface WikiDraftDetailResponse {
  draft: WikiDraftNode;
  bodyHtml?: string;
}

export function useWikiDraft(id: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.wikiDrafts.detail(id ?? ''),
    enabled: id != null,
    queryFn: async (): Promise<WikiDraftDetailResponse> => {
      const response = await api.vault['wiki-drafts'][':id'].$get({ param: { id: id ?? '' } });
      const body = (await response.json()) as {
        draft?: WikiDraftNode;
        bodyHtml?: string;
        error?: string;
      };
      if (!response.ok || !body.draft) throw new Error(body.error ?? 'Wiki draft not found.');
      return { draft: body.draft, bodyHtml: body.bodyHtml };
    },
  });
}

function useDraftAction(action: 'promote' | 'reject') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.vault['wiki-drafts'][':id'][action].$post({ param: { id } });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Could not ${action} wiki draft.`);
      return body;
    },
    onSuccess: async (_result, id) => invalidateWikiDraftCaches(queryClient, id),
  });
}

export function usePromoteWikiDraft() {
  return useDraftAction('promote');
}

export function useRejectWikiDraft() {
  return useDraftAction('reject');
}

export function useRegenerateWikiDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await api.vault['wiki-drafts'][':id'].regenerate.$post({ param: { id } });
      const body = (await response.json()) as { draftId?: string; error?: string };
      if (!response.ok || !body.draftId) throw new Error(body.error ?? 'Could not regenerate wiki draft.');
      return body.draftId;
    },
    onSuccess: async (_result, id) => invalidateWikiDraftCaches(queryClient, id),
  });
}

export function useResolveWikiDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      targetWikiId,
      distinctTopicKey,
    }: {
      id: string;
      targetWikiId?: string;
      distinctTopicKey?: string;
    }) => {
      const response = await api.vault['wiki-drafts'][':id']['resolve-topic'].$post({
        param: { id },
        json: {
          ...(targetWikiId ? { target_wiki_id: targetWikiId } : {}),
          ...(distinctTopicKey ? { distinct_topic_key: distinctTopicKey } : {}),
        },
      });
      const body = (await response.json()) as { draftId?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not resolve wiki topic.');
      return body;
    },
    onSuccess: async (_result, { id }) => invalidateWikiDraftCaches(queryClient, id),
  });
}

export function useEditWikiDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      const response = await api.vault['wiki-drafts'][':id'].$patch({ param: { id }, json: { title } });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Could not edit wiki draft.');
    },
    onSuccess: async (_result, { id }) => invalidateWikiDraftCaches(queryClient, id),
  });
}
