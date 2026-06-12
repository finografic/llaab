import { PageHero } from 'components/PageHero/PageHero';
import { TerminalPanel } from 'components/TerminalPanel';
import { PageLayout } from 'layouts/PageLayout/PageLayout';

import { usePageTitle } from 'lib/use-page-title';

export function TerminalPage() {
  usePageTitle('Terminal');

  return (
    <PageLayout hero={<PageHero eyebrow="Execute" title="Terminal" />}>
      <TerminalPanel />
    </PageLayout>
  );
}
