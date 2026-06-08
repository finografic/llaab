import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from 'lib/api';

import { QUERY_KEYS } from './index';

export interface CreateIdeaInput {
  title: string;
  body?: string;
  tags?: string[];
}

export interface CreateIdeaResult {
  id: string;
  path: string;
  type: string;
}

/** Create an idea node, invalidating node listings (and tag-usage rankings derived from them). */
export function useCreateIdea() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateIdeaInput): Promise<CreateIdeaResult> => {
      const res = await api.vault.nodes.$post({
        json: {
          type: 'idea',
          title: input.title,
          body: input.body || undefined,
          tags: input.tags && input.tags.length > 0 ? input.tags : undefined,
        },
      });
      const json = await res.json();
      if ('error' in json) throw new Error(json.error);

      return json;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.nodes.all });
    },
  });
}
