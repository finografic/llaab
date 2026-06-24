import { useQuery } from '@tanstack/react-query';
import type { VaultNode } from 'components/VaultBrowser/vault-browser.types';

import { api } from 'lib/api';

import { QUERY_KEYS } from './index';

async function fetchVaultTree(): Promise<VaultNode[]> {
  const res = await api.vault.tree.$get();
  const body = (await res.json()) as { tree?: VaultNode[] };

  if (!res.ok || !body.tree) {
    throw new Error('Failed to load vault tree.');
  }

  return body.tree;
}

/** Fetch the vault file tree for VaultBrowser. */
export function useVaultTree() {
  return useQuery({
    queryKey: QUERY_KEYS.vault.tree(),
    queryFn: fetchVaultTree,
  });
}
