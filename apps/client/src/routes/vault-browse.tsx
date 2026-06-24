import { VaultBrowser } from 'components/VaultBrowser/VaultBrowser';
import { useVaultTree } from 'queries/vault';

import { usePageTitle } from 'lib/use-page-title';

export function VaultBrowsePage() {
  usePageTitle('Vault');

  const { data: tree, isLoading, error } = useVaultTree();

  if (isLoading) {
    return <p className="text-muted-foreground p-6 text-sm">Loading vault tree…</p>;
  }

  if (error) {
    return (
      <p className="text-destructive p-6 text-sm">
        {error instanceof Error ? error.message : 'Failed to load vault tree.'}
      </p>
    );
  }

  if (!tree) return null;

  return <VaultBrowser tree={tree} />;
}
