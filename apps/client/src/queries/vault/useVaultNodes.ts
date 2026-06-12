import { useQuery } from '@tanstack/react-query';
import type { LabNode, NodeType } from '@llaab/schemas';

import { api } from 'lib/api';

import { QUERY_KEYS } from './index';

export interface UseVaultNodesOptions {
  type?: NodeType;
  enabled?: boolean;
}

async function fetchVaultNodes(type?: NodeType): Promise<LabNode[]> {
  const res = await api.vault.nodes.$get({
    query: {
      type,
      tags: undefined,
      limit: undefined,
      status: undefined,
      search: undefined,
    },
  });
  const body = (await res.json()) as { nodes?: LabNode[] };

  if (!res.ok || !body.nodes) {
    throw new Error('Failed to load vault nodes.');
  }

  return body.nodes;
}

/** List vault nodes, optionally filtered by node type. */
export function useVaultNodes({ type, enabled = true }: UseVaultNodesOptions = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.vault.nodes(type),
    queryFn: () => fetchVaultNodes(type),
    enabled,
  });
}

/** Fetch a single node by id from the full vault list. */
export function useVaultNode(id: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.vault.node(id ?? ''),
    queryFn: async () => {
      if (!id) throw new Error('Node id is required.');
      const res = await api.vault.nodes[':id'].$get({ param: { id } });
      const body = (await res.json()) as { node?: LabNode; error?: string };
      if (!res.ok || !body.node) {
        throw new Error(body.error ?? 'Node not found');
      }
      return body.node;
    },
    enabled: Boolean(id),
  });
}
