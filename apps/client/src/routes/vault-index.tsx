import { PageHero } from 'components/PageHero/PageHero';
import { PageLayout } from 'layouts/PageLayout/PageLayout';

import { usePageTitle } from 'lib/use-page-title';

/** Placeholder until Phase 4 ports VaultBrowser + tree fetch. */
export function VaultIndexPage() {
  usePageTitle('Vault');

  return (
    <PageLayout hero={<PageHero eyebrow="Vault" title="Browse Vault" />}>
      <p className="text-muted-foreground text-sm">Vault browser route — port in Phase 4.</p>
    </PageLayout>
  );
}
