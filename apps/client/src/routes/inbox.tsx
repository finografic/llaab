import { InboxCaptureFilters } from 'components/InboxCaptureFilters/InboxCaptureFilters';
import { InboxCaptureList } from 'components/InboxCaptureList/InboxCaptureList';
import { PageHero } from 'components/PageHero/PageHero';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from 'components/ui/alert-dialog';
import { Button } from 'components/ui/button';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { PageList } from 'layouts/PageList/PageList';
import { useBatchUpdateVaultNodes, useVaultNodes } from 'queries/vault';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';

import {
  filterInboxCaptures,
  groupInboxCaptures,
  inboxFiltersToSearchParams,
  parseInboxFiltersFromSearchParams,
} from 'lib/inbox-capture-filters';
import { INBOX_LIST_TAGS, isInboxCaptureNode, parseInboxCapture } from 'lib/inbox-capture.utils';
import { getInboxReviewState, withInboxReviewState } from 'lib/inbox-review.utils';
import { usePageTitle } from 'lib/use-page-title';

import styles from './inbox.module.css';

export function InboxPage() {
  usePageTitle('Inbox');

  const [searchParams, setSearchParams] = useSearchParams();
  const [confirmBatchArchive, setConfirmBatchArchive] = useState(false);
  const filters = parseInboxFiltersFromSearchParams(searchParams);
  const batchUpdate = useBatchUpdateVaultNodes();

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
  const reviewedVisible = filteredCaptures.filter(
    (capture) => getInboxReviewState(capture.node) === 'reviewed',
  );

  const archiveReviewed = async () => {
    try {
      // Batch endpoint applies one tags array to all ids; archive reviewed items one-by-one
      // when tag sets differ, otherwise a single batch call.
      const tagSignature = (tags: string[]) => withInboxReviewState(tags, 'archived').join('\0');
      const groupsByTags = Map.groupBy(reviewedVisible, (capture) => tagSignature(capture.node.tags));

      for (const group of groupsByTags.values()) {
        const first = group[0];
        if (!first) continue;
        await batchUpdate.mutateAsync({
          ids: group.map((capture) => capture.node.id),
          tags: withInboxReviewState(first.node.tags, 'archived'),
        });
      }

      toast.success(
        `Archived ${reviewedVisible.length} reviewed capture${reviewedVisible.length === 1 ? '' : 's'}`,
      );
      setConfirmBatchArchive(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to archive captures.');
    }
  };

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
          right={
            reviewedVisible.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={batchUpdate.isPending}
                onClick={() => setConfirmBatchArchive(true)}
              >
                Archive reviewed ({reviewedVisible.length})
              </Button>
            ) : null
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

      <AlertDialog open={confirmBatchArchive} onOpenChange={setConfirmBatchArchive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive reviewed captures?</AlertDialogTitle>
            <AlertDialogDescription>
              This archives {reviewedVisible.length} reviewed capture
              {reviewedVisible.length === 1 ? '' : 's'} currently visible in the list. Nodes stay in the vault
              and can be unarchived later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={batchUpdate.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={batchUpdate.isPending}
              onClick={() => {
                void archiveReviewed();
              }}
            >
              Archive reviewed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}
