import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { LabNode, NodeStatus } from '@llaab/schemas';

import { api } from 'lib/api';

import { QUERY_KEYS } from './index';

export interface UpdateVaultNodeInput {
  id: string;
  tags?: string[];
  status?: NodeStatus;
}

export interface BatchUpdateVaultNodesInput {
  ids: string[];
  tags?: string[];
  status?: NodeStatus;
}

async function invalidateVaultNodeQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await queryClient.invalidateQueries({ queryKey: QUERY_KEYS.vault.all });
}

/** Patch a vault node's tags and/or status. */
export function useUpdateVaultNode() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateVaultNodeInput): Promise<LabNode> => {
      const res = await api.vault.nodes[':id'].$patch({
        param: { id: input.id },
        json: {
          tags: input.tags,
          status: input.status,
        },
      });
      const body = (await res.json()) as { node?: LabNode; error?: string };
      if (!res.ok || !body.node) {
        throw new Error(body.error ?? 'Failed to update node.');
      }
      return body.node;
    },
    onSuccess: async (node) => {
      queryClient.setQueryData(QUERY_KEYS.vault.node(node.id), node);
      await invalidateVaultNodeQueries(queryClient);
    },
  });
}

/** Batch-patch vault node tags and/or status. */
export function useBatchUpdateVaultNodes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: BatchUpdateVaultNodesInput): Promise<LabNode[]> => {
      const res = await api.vault.nodes.batch.$post({
        json: {
          ids: input.ids,
          tags: input.tags,
          status: input.status,
        },
      });
      const body = (await res.json()) as { nodes?: LabNode[]; error?: string };
      if (!res.ok || !body.nodes) {
        throw new Error(body.error ?? 'Failed to update nodes.');
      }
      return body.nodes;
    },
    onSuccess: async () => {
      await invalidateVaultNodeQueries(queryClient);
    },
  });
}
