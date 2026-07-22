export interface VaultNodesQueryKeyInput {
  type?: string;
  tags?: string[];
  search?: string;
  status?: string;
  limit?: number;
}

export const QUERY_KEYS = {
  vault: {
    all: ['vault'] as const,
    file: (path: string) => [...QUERY_KEYS.vault.all, 'file', path] as const,
    fileDiff: (path: string) => [...QUERY_KEYS.vault.all, 'file-diff', path] as const,
    nodes: (input?: string | VaultNodesQueryKeyInput) => {
      if (typeof input === 'string' || input === undefined) {
        return [...QUERY_KEYS.vault.all, 'nodes', input ?? 'all'] as const;
      }

      return [
        ...QUERY_KEYS.vault.all,
        'nodes',
        input.type ?? 'all',
        input.tags?.join(',') ?? '',
        input.search ?? '',
        input.status ?? '',
        input.limit ?? '',
      ] as const;
    },
    node: (id: string) => [...QUERY_KEYS.vault.all, 'node', id] as const,
    tree: () => [...QUERY_KEYS.vault.all, 'tree'] as const,
    enrichedSource: (id: string) => [...QUERY_KEYS.vault.all, 'source', id, 'enriched'] as const,
    gitStatus: () => [...QUERY_KEYS.vault.all, 'git-status'] as const,
  },
};

export { useVaultFile } from './useVaultFile';
export { useVaultFileDiff } from './useVaultFileDiff';
export { useVaultClean } from './useVaultClean';
export { useVaultNodes, useVaultNode } from './useVaultNodes';
export { useUpdateVaultNode, useBatchUpdateVaultNodes } from './useUpdateVaultNode';
export { usePromoteInboxCapture } from './usePromoteInboxCapture';
export { useDeleteVaultNode } from './useDeleteVaultNode';
export type { DeleteVaultNodeResult } from './useDeleteVaultNode';
export { useDeleteVaultNodes } from './useDeleteVaultNodes';
export type { DeleteVaultNodesResult } from './useDeleteVaultNodes';
export { useVaultTree } from './useVaultTree';
export { useVaultGitStatus } from './useVaultGitStatus';
export { useVaultGitCommit } from './useVaultGitCommit';
export { useVaultGitReset } from './useVaultGitReset';
export type { VaultCleanResult } from './useVaultClean';
