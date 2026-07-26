import { useQuery } from '@tanstack/react-query';

import { api } from 'lib/api';

import { QUERY_KEYS } from './index';

export interface VaultFileContent {
  content: string;
  html: string | null;
}

async function fetchVaultFile(path: string, renderMarkdown: boolean): Promise<VaultFileContent> {
  const res = await api.vault.file.$get({
    query: { path, ...(renderMarkdown ? { render: 'markdown' } : {}) },
  });
  const json = await res.json();
  if ('error' in json) throw new Error(json.error);
  return { content: json.content, html: json.html ?? null };
}

/** Raw contents of a vault file by relative path. Disabled until a path is selected. */
export function useVaultFile(path: string | null, enabled = true, renderMarkdown = false) {
  return useQuery({
    queryKey: QUERY_KEYS.vault.file(path ?? '', renderMarkdown),
    queryFn: () => fetchVaultFile(path as string, renderMarkdown),
    enabled: enabled && path != null,
  });
}
