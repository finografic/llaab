import { InboxCaptureFilters } from 'components/InboxCaptureFilters/InboxCaptureFilters';
import { InboxCaptureList } from 'components/InboxCaptureList/InboxCaptureList';
import { PageHero } from 'components/PageHero/PageHero';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { PageList } from 'layouts/PageList/PageList';
import { useVaultNodes } from 'queries/vault';
import { useSearchParams } from 'react-router-dom';

import {
  filterInboxCaptures,
  groupInboxCaptures,
  inboxFiltersToSearchParams,
  parseInboxFiltersFromSearchParams,
} from 'lib/inbox-capture-filters';
import { INBOX_LIST_TAGS, isInboxCaptureNode, parseInboxCapture } from 'lib/inbox-capture.utils';
import { usePageTitle } from 'lib/use-page-title';

import styles from './inbox.module.css';

export function InboxPage() {
  usePageTitle('Inbox');

  const [searchParams, setSearchParams] = useSearchParams();
  const filters = parseInboxFiltersFromSearchParams(searchParams);

  const {
    data: nodes = [],
    isLoading,
    isError,
    error,
  } = useVaultNodes({
    tags: [...INBOX_LIST_TAGS],
    search: filters.search.trim() || undefined,
  });

  // Server tag filter is OR; keep only Hermes inbox-tagged captures for this page.
  const allCaptures = nodes.filter(isInboxCaptureNode).map(parseInboxCapture);
  const filteredCaptures = filterInboxCaptures(allCaptures, filters);
  const groups = groupInboxCaptures(filteredCaptures, filters.groupBy);
  const statusOptions = [...new Set(allCaptures.map((capture) => capture.node.status))].toSorted();

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Vault"
          title="Inbox"
          description="Captures from Telegram and other Hermes inbox drops."
          meta={
            <>
              {filteredCaptures.length} shown
              {filteredCaptures.length !== allCaptures.length ? ` · ${allCaptures.length} total` : null}
            </>
          }
        />
      }
    >
      <PageList width="wide">
        <InboxCaptureFilters
          filters={filters}
          statusOptions={statusOptions}
          onChange={(next) => {
            setSearchParams(inboxFiltersToSearchParams(next), { replace: true });
          }}
        />

        {groups.map((group) => (
          <section key={group.key} className={styles.group}>
            {filters.groupBy !== 'none' ? (
              <h2 className={styles.groupHeading}>
                {group.label}
                <span className={styles.groupCount}>{group.captures.length}</span>
              </h2>
            ) : null}
            <InboxCaptureList
              captures={group.captures}
              loading={isLoading}
              error={isError ? (error instanceof Error ? error.message : 'Failed to load inbox.') : null}
              emptyMessage={
                allCaptures.length === 0
                  ? 'No Hermes inbox captures yet. Drop a link or note in Telegram to see it here.'
                  : 'No captures match the current filters.'
              }
            />
          </section>
        ))}
      </PageList>
    </PageLayout>
  );
}
