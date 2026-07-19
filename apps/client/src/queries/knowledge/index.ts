import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { KnowledgeWikiPage } from '@llaab/schemas';

import { api } from 'lib/api';

export const QUERY_KEYS = {
  knowledge: {
    all: ['knowledge'] as const,
    wikis: () => [...QUERY_KEYS.knowledge.all, 'wikis'] as const,
    wiki: (id: string) => [...QUERY_KEYS.knowledge.wikis(), id] as const,
  },
};

export function useKnowledgeWikis() {
  return useQuery({
    queryKey: QUERY_KEYS.knowledge.wikis(),
    queryFn: async (): Promise<KnowledgeWikiPage[]> => {
      const response = await api.knowledge.wikis.$get();
      const body = (await response.json()) as { wikis?: KnowledgeWikiPage[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Failed to load knowledge wikis.');
      return body.wikis ?? [];
    },
  });
}

export function useKnowledgeWiki(id: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.knowledge.wiki(id ?? ''),
    enabled: id != null,
    queryFn: async (): Promise<KnowledgeWikiDetail> => {
      const response = await api.knowledge.wikis[':id'].$get({ param: { id: id ?? '' } });
      const body = (await response.json()) as Partial<KnowledgeWikiDetail> & { error?: string };
      if (!response.ok || !body.wiki) throw new Error(body.error ?? 'Failed to load knowledge wiki.');
      return {
        wiki: body.wiki,
        bodyHtml: body.bodyHtml ?? '',
        sections: body.sections ?? [],
      };
    },
  });
}

export interface RenderedWikiSection {
  id: string;
  heading: string;
  html: string;
}

export interface KnowledgeWikiDetail {
  wiki: KnowledgeWikiPage;
  bodyHtml: string;
  sections: RenderedWikiSection[];
}

function useWikiSectionMutation(kind: 'regenerate' | 'delete') {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ wikiId, sectionId }: { wikiId: string; sectionId: string }) => {
      const route = api.knowledge.wikis[':id'].sections[':sectionId'];
      const response =
        kind === 'regenerate'
          ? await route.regenerate.$post({ param: { id: wikiId, sectionId } })
          : await route.$delete({ param: { id: wikiId, sectionId } });
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? `Failed to ${kind} wiki section.`);
      return body;
    },
    onSuccess: (_result, input) => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.knowledge.wiki(input.wikiId) });
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.knowledge.wikis() });
    },
  });
}

export function useRegenerateKnowledgeWikiSection() {
  return useWikiSectionMutation('regenerate');
}

export function useDeleteKnowledgeWikiSection() {
  return useWikiSectionMutation('delete');
}

export interface KnowledgeWikiGraph {
  nodes: Array<{ id: string; title: string; tags: string[] }>;
  edges: Array<{
    source: string;
    target: string;
    relation: string;
    inferred?: 'shared-tags' | 'shared-transcript';
    shared_tags?: string[];
    shared_transcript_ids?: string[];
  }>;
  reverse_edges: KnowledgeWikiGraph['edges'];
  diagnostics: string[];
}

export function useKnowledgeWikiGraph() {
  return useQuery({
    queryKey: [...QUERY_KEYS.knowledge.wikis(), 'graph'] as const,
    queryFn: async (): Promise<KnowledgeWikiGraph> => {
      const response = await api.knowledge.wikis.graph.$get();
      const body = (await response.json()) as { graph?: KnowledgeWikiGraph; error?: string };
      if (!response.ok || !body.graph) throw new Error(body.error ?? 'Failed to load knowledge graph.');
      return body.graph;
    },
  });
}
