import { useQuery } from '@tanstack/react-query';

import { api } from 'lib/api';

import { QUERY_KEYS } from './index';

export async function fetchNodeTags(nodeId: string): Promise<string[]> {
  try {
    const res = await api.vault.nodes[':id'].$get({ param: { id: nodeId } });
    const json = (await res.json()) as { node?: { tags?: string[] } };
    return json.node?.tags ?? [];
  } catch {
    return [];
  }
}

/** A single node's tags — used to seed "locked" tags inherited from a related node. */
export function useNodeTags(nodeId: string | null) {
  return useQuery({
    queryKey: QUERY_KEYS.nodes.tags(nodeId ?? ''),
    queryFn: () => fetchNodeTags(nodeId as string),
    enabled: nodeId != null,
  });
}

async function fetchVaultTagsByUsage(): Promise<string[]> {
  try {
    const res = await api.vault.nodes.$get({ query: { tags: undefined, limit: undefined } });
    const json = (await res.json()) as { nodes?: Array<{ tags?: string[] }> };
    const counts = new Map<string, number>();
    for (const node of json.nodes ?? []) {
      for (const tag of node.tags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()].toSorted((a, b) => b[1] - a[1]).map(([tag]) => tag);
  } catch {
    return [];
  }
}

/** Tags already used across the vault, ranked by usage count (most-used first). */
export function useVaultTagsByUsage() {
  return useQuery({
    queryKey: QUERY_KEYS.nodes.tagsByUsage(),
    queryFn: fetchVaultTagsByUsage,
  });
}
