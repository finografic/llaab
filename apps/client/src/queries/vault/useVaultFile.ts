import { useQuery } from '@tanstack/react-query';

import { api } from 'lib/api';

import { QUERY_KEYS } from './index';

export interface VaultFileContent {
  content: string;
  html: string | null;
  sections: VaultMarkdownSection[];
}

export interface VaultMarkdownSection {
  id: string;
  heading: string;
  markdown: string;
  html: string;
}

export type VaultMarkdownRenderMode = 'raw' | 'render' | 'enhanced';

async function fetchVaultFile(path: string, renderMode: VaultMarkdownRenderMode): Promise<VaultFileContent> {
  const render = renderMode === 'enhanced' ? 'sections' : renderMode === 'render' ? 'markdown' : undefined;
  const res = await api.vault.file.$get({
    query: { path, ...(render ? { render } : {}) },
  });
  const json = await res.json();
  if ('error' in json) throw new Error(json.error);
  return { content: json.content, html: json.html ?? null, sections: json.sections ?? [] };
}

/** Raw contents of a vault file by relative path. Disabled until a path is selected. */
export function useVaultFile(
  path: string | null,
  enabled = true,
  renderMode: VaultMarkdownRenderMode = 'raw',
) {
  return useQuery({
    queryKey: QUERY_KEYS.vault.file(path ?? '', renderMode),
    queryFn: () => fetchVaultFile(path as string, renderMode),
    enabled: enabled && path != null,
  });
}
