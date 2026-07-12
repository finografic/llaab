import { PageHero } from 'components/PageHero/PageHero';
import { TerminalPanel } from 'components/TerminalPanel';
import { PageLayout } from 'layouts/PageLayout/PageLayout';

import { usePageTitle } from 'lib/use-page-title';

export function TerminalPage() {
  usePageTitle('Terminal');

  return (
    <PageLayout
      fillHeight
      hero={
        <PageHero
          eyebrow="Execute"
          title="Terminal"
          description="Typed command bus for orchestration adapters."
        />
      }
    >
      <TerminalPanel />
    </PageLayout>
  );
}
