import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { WikiCandidateNode } from '@llaab/schemas';

import { api } from 'lib/api';

export const QUERY_KEYS = {
  wikiCandidates: ['wiki-candidates'] as const,
};

export function useWikiCandidates() {
  return useQuery({
    queryKey: QUERY_KEYS.wikiCandidates,
    queryFn: async (): Promise<WikiCandidateNode[]> => {
      const response = await api.vault['wiki-candidates'].$get();
      const body = (await response.json()) as { candidates?: WikiCandidateNode[]; error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Failed to load wiki candidates.');
      return body.candidates ?? [];
    },
  });
}

export function useDiscoverWikiCandidates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const response = await api.vault['wiki-candidates'].discover.$post();
      const body = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? 'Wiki discovery failed.');
      return body;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.wikiCandidates }),
  });
}
