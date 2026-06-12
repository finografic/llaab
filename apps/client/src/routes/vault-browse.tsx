import { PageHero } from 'components/PageHero/PageHero';
import { VaultBrowser } from 'components/VaultBrowser';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { useVaultTree } from 'queries/vault';

import { usePageTitle } from 'lib/use-page-title';

export function VaultBrowsePage() {
  usePageTitle('Vault');

  const { data: tree, isLoading, error } = useVaultTree();

  return (
    <PageLayout hero={<PageHero eyebrow="Vault" title="Browse Vault" />}>
      {isLoading ? <p className="text-muted-foreground text-sm">Loading vault tree…</p> : null}
      {error ? (
        <p className="text-destructive text-sm">
          {error instanceof Error ? error.message : 'Failed to load vault tree.'}
        </p>
      ) : null}
      {tree ? <VaultBrowser tree={tree} /> : null}
    </PageLayout>
  );
}
