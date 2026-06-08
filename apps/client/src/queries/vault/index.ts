export const QUERY_KEYS = {
  vault: {
    all: ['vault'] as const,
    file: (path: string) => [...QUERY_KEYS.vault.all, 'file', path] as const,
  },
};

export { useVaultFile } from './useVaultFile';
export { useVaultClean } from './useVaultClean';
export type { VaultCleanResult } from './useVaultClean';
