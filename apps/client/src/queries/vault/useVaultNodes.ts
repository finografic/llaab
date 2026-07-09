import { useQuery } from '@tanstack/react-query';
import type { LabNode, NodeStatus, NodeType } from '@llaab/schemas';

import { api } from 'lib/api';

import { QUERY_KEYS } from './index';

export interface UseVaultNodesOptions {
  type?: NodeType;
  tags?: string[];
  search?: string;
  status?: NodeStatus;
  limit?: number;
  enabled?: boolean;
}

async function fetchVaultNodes({
  type,
  tags,
  search,
  status,
  limit,
}: Omit<UseVaultNodesOptions, 'enabled'>): Promise<LabNode[]> {
  const res = await api.vault.nodes.$get({
    query: {
      type,
      tags: tags?.length ? tags : undefined,
      limit,
      status,
      search,
    },
  });
  const body = (await res.json()) as { nodes?: LabNode[] };

  if (!res.ok || !body.nodes) {
    throw new Error('Failed to load vault nodes.');
  }

  return body.nodes;
}

/** List vault nodes, optionally filtered by type, tags, search, or status. */
export function useVaultNodes({
  type,
  tags,
  search,
  status,
  limit,
  enabled = true,
}: UseVaultNodesOptions = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.vault.nodes({ type, tags, search, status, limit }),
    queryFn: () => fetchVaultNodes({ type, tags, search, status, limit }),
    enabled,
  });
}

/** Fetch a single node by id from the vault API. */
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
