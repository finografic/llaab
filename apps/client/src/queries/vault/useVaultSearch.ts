import { useQuery } from '@tanstack/react-query';
import type { LabNode, NodeStatus, NodeType } from '@llaab/schemas';

import { api } from 'lib/api';

import { QUERY_KEYS } from './index';

export type VaultSearchMatchField = 'title' | 'tag' | 'body';

export interface VaultSearchMatch {
  field: VaultSearchMatchField;
  value?: string;
}

export interface VaultSearchResult {
  node: LabNode;
  node_id: string;
  node_type: NodeType;
  title: string;
  status: NodeStatus;
  tags: string[];
  path: string;
  score: number;
  snippet: string;
  matches: VaultSearchMatch[];
  provenance: {
    node_id: string;
    node_type: NodeType;
    path: string;
  };
}

export interface UseVaultSearchOptions {
  query: string;
  type?: NodeType;
  status?: NodeStatus;
  tags?: string[];
  limit?: number;
}

async function fetchVaultSearch({ query, type, status, tags, limit }: UseVaultSearchOptions) {
  const searchQuery = {
    limit: limit !== undefined ? String(limit) : undefined,
    query,
    status,
    tags: tags?.length ? tags.join(',') : undefined,
    type,
  } as Parameters<typeof api.vault.search.$get>[0]['query'];

  const res = await api.vault.search.$get({ query: searchQuery });
  const body = (await res.json()) as { results?: VaultSearchResult[]; error?: string };

  if (!res.ok || !body.results) {
    throw new Error(body.error ?? 'Failed to search the vault.');
  }

  return body.results;
}

export function useVaultSearch(options: UseVaultSearchOptions) {
  const query = options.query.trim();

  return useQuery({
    enabled: query.length > 0,
    queryFn: () => fetchVaultSearch({ ...options, query }),
    queryKey: QUERY_KEYS.vault.search({ ...options, query }),
  });
}
