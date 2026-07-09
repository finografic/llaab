import { InboxCaptureList } from 'components/InboxCaptureList/InboxCaptureList';
import { PageHero } from 'components/PageHero/PageHero';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { PageList } from 'layouts/PageList/PageList';
import { useVaultNodes } from 'queries/vault';

import { INBOX_LIST_TAGS, isInboxCaptureNode, parseInboxCapture } from 'lib/inbox-capture.utils';
import { usePageTitle } from 'lib/use-page-title';

export function InboxPage() {
  usePageTitle('Inbox');

  const { data: nodes = [], isLoading, isError, error } = useVaultNodes({ tags: [...INBOX_LIST_TAGS] });

  // Server tag filter is OR; keep only Hermes inbox-tagged captures for this page.
  const captures = nodes
    .filter(isInboxCaptureNode)
    .map(parseInboxCapture)
    .toSorted((a, b) => b.receivedAt.localeCompare(a.receivedAt));

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Vault"
          title="Inbox"
          description="Captures from Telegram and other Hermes inbox drops."
          meta={
            <>
              {captures.length} capture{captures.length !== 1 ? 's' : ''}
            </>
          }
        />
      }
    >
      <PageList width="wide">
        <InboxCaptureList
          captures={captures}
          loading={isLoading}
          error={isError ? (error instanceof Error ? error.message : 'Failed to load inbox.') : null}
          emptyMessage="No Hermes inbox captures yet. Drop a link or note in Telegram to see it here."
        />
      </PageList>
    </PageLayout>
  );
}
