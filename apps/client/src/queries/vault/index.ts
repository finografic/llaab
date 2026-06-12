export const QUERY_KEYS = {
  vault: {
    all: ['vault'] as const,
    file: (path: string) => [...QUERY_KEYS.vault.all, 'file', path] as const,
    nodes: (type?: string) => [...QUERY_KEYS.vault.all, 'nodes', type ?? 'all'] as const,
    node: (id: string) => [...QUERY_KEYS.vault.all, 'node', id] as const,
    tree: () => [...QUERY_KEYS.vault.all, 'tree'] as const,
    enrichedSource: (id: string) => [...QUERY_KEYS.vault.all, 'source', id, 'enriched'] as const,
  },
};

export { useVaultFile } from './useVaultFile';
export { useVaultClean } from './useVaultClean';
export { useVaultNodes, useVaultNode } from './useVaultNodes';
export { useVaultTree } from './useVaultTree';
export type { VaultCleanResult } from './useVaultClean';
