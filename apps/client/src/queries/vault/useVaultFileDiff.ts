import { useQuery } from '@tanstack/react-query';

import { apiGet } from 'lib/api-client';

import { QUERY_KEYS } from './index';

interface VaultFileDiffResponse {
  patch: string;
}

async function fetchVaultFileDiff(path: string): Promise<string> {
  const query = new URLSearchParams({ path });
  const result = await apiGet<VaultFileDiffResponse>(`/api/vault/git/diff?${query.toString()}`);
  return result.patch;
}

/** Working-tree diff for a tracked vault file. Disabled until diff mode selects a path. */
export function useVaultFileDiff(path: string | null, enabled: boolean) {
  return useQuery({
    queryKey: QUERY_KEYS.vault.fileDiff(path ?? ''),
    queryFn: () => fetchVaultFileDiff(path as string),
    enabled: enabled && path != null,
  });
}
