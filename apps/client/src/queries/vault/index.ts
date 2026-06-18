export const QUERY_KEYS = {
  vault: {
    all: ['vault'] as const,
    file: (path: string) => [...QUERY_KEYS.vault.all, 'file', path] as const,
    nodes: (type?: string) => [...QUERY_KEYS.vault.all, 'nodes', type ?? 'all'] as const,
    node: (id: string) => [...QUERY_KEYS.vault.all, 'node', id] as const,
    tree: () => [...QUERY_KEYS.vault.all, 'tree'] as const,
    enrichedSource: (id: string) => [...QUERY_KEYS.vault.all, 'source', id, 'enriched'] as const,
    gitStatus: () => [...QUERY_KEYS.vault.all, 'git-status'] as const,
  },
};

export { useVaultFile } from './useVaultFile';
export { useVaultClean } from './useVaultClean';
export { useVaultNodes, useVaultNode } from './useVaultNodes';
export { useVaultTree } from './useVaultTree';
export { useVaultGitStatus } from './useVaultGitStatus';
export { useVaultGitCommit } from './useVaultGitCommit';
export { useVaultGitReset } from './useVaultGitReset';
export type { VaultCleanResult } from './useVaultClean';
