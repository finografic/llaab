import { useQuery } from '@tanstack/react-query';
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
    queryFn: async (): Promise<KnowledgeWikiPage> => {
      const response = await api.knowledge.wikis[':id'].$get({ param: { id: id ?? '' } });
      const body = (await response.json()) as { wiki?: KnowledgeWikiPage; error?: string };
      if (!response.ok || !body.wiki) throw new Error(body.error ?? 'Failed to load knowledge wiki.');
      return body.wiki;
    },
  });
}

export interface KnowledgeWikiGraph {
  nodes: Array<{ id: string; title: string }>;
  edges: Array<{ source: string; target: string; relation: string }>;
  reverse_edges: Array<{ source: string; target: string; relation: string }>;
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
