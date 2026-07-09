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
  // Hono RPC types the query from Zod *output* (tags: string[]), but the wire format
  // must be a comma-separated string — otherwise the client emits `?tags=a&tags=b`
  // and Zod rejects it with 400.
  const query = {
    type,
    tags: tags?.length ? tags.join(',') : undefined,
    limit: limit !== undefined ? String(limit) : undefined,
    status,
    search,
  } as Parameters<typeof api.vault.nodes.$get>[0]['query'];

  const res = await api.vault.nodes.$get({ query });
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
