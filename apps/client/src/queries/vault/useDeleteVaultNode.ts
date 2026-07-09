import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from 'lib/api';

import { QUERY_KEYS } from './index';

export interface DeleteVaultNodeResult {
  deleted: { id: string; type: string; title: string };
  scrubbedReferences: Array<{ id: string; type: string; changes: string[] }>;
}

/** Delete an idea/resource vault node and scrub inbound references. */
export function useDeleteVaultNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<DeleteVaultNodeResult> => {
      const res = await api.vault.nodes[':id'].$delete({ param: { id } });
      const body = (await res.json().catch(() => null)) as
        | (DeleteVaultNodeResult & { success?: boolean; error?: string })
        | null;

      if (!res.ok || !body?.deleted) {
        throw new Error(body?.error ?? 'Failed to delete node.');
      }

      return {
        deleted: body.deleted,
        scrubbedReferences: body.scrubbedReferences ?? [],
      };
    },
    onSuccess: async (_result, id) => {
      queryClient.removeQueries({ queryKey: QUERY_KEYS.vault.node(id) });
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vault.all });
    },
  });
}
