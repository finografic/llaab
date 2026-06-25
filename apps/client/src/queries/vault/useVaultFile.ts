import { useQuery } from '@tanstack/react-query';

import { api } from 'lib/api';

import { QUERY_KEYS } from './index';

async function fetchVaultFile(path: string): Promise<string> {
  const res = await api.vault.file.$get({ query: { path } });
  const json = await res.json();
  if ('error' in json) throw new Error(json.error);
  return json.content;
}

/** Raw contents of a vault file by relative path. Disabled until a path is selected. */
export function useVaultFile(path: string | null, enabled = true) {
  return useQuery({
    queryKey: QUERY_KEYS.vault.file(path ?? ''),
    queryFn: () => fetchVaultFile(path as string),
    enabled: enabled && path != null,
  });
}
