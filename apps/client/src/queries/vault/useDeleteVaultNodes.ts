import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { DeleteVaultNodeResult } from './useDeleteVaultNode';

import { api } from 'lib/api';

import { QUERY_KEYS } from './index';

export interface DeleteVaultNodesResult {
  deleted: Array<DeleteVaultNodeResult['deleted']>;
  scrubbedReferences: DeleteVaultNodeResult['scrubbedReferences'];
}

/** Delete multiple idea/resource vault nodes and scrub inbound references. */
export function useDeleteVaultNodes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (ids: string[]): Promise<DeleteVaultNodesResult> => {
      const deleted: Array<DeleteVaultNodeResult['deleted']> = [];
      const scrubbedReferences: DeleteVaultNodeResult['scrubbedReferences'] = [];

      for (const id of ids) {
        const res = await api.vault.nodes[':id'].$delete({ param: { id } });
        const body = (await res.json().catch(() => null)) as
          | (DeleteVaultNodeResult & { success?: boolean; error?: string })
          | null;

        if (!res.ok || !body?.deleted) {
          throw new Error(body?.error ?? `Failed to delete node ${id}.`);
        }

        deleted.push(body.deleted);
        scrubbedReferences.push(...(body.scrubbedReferences ?? []));
      }

      return { deleted, scrubbedReferences };
    },
    onSuccess: async (_result, ids) => {
      for (const id of ids) {
        queryClient.removeQueries({ queryKey: QUERY_KEYS.vault.node(id) });
      }
      await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vault.all });
    },
  });
}
