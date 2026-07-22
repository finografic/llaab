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
import { Badge } from 'components/ui/badge';
import { Button } from 'components/ui/button';
import { Checkbox } from 'components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from 'components/ui/collapsible';
import { Col, Row } from 'components/ui/grid';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { PageList } from 'layouts/PageList/PageList';
import {
  Clock3Icon,
  FileExclamationPointIcon,
  FileQuestionIcon,
  InfoIcon,
  PaperclipIcon,
  TrashIcon,
  TriangleAlertIcon,
  ZapIcon,
} from 'lucide-react';
import { useBatchUpdateVaultNodes, useDeleteVaultNodes, useVaultNodes } from 'queries/vault';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { LucideIcon } from 'lucide-react';

import {
  filterInboxCaptures,
  groupInboxCaptures,
  inboxCaptureNeedsAttention,
  inboxFiltersToSearchParams,
  INBOX_CAPTURE_VIEWS,
  matchesInboxCaptureView,
  parseInboxFiltersFromSearchParams,
} from 'lib/inbox-capture-filters';
import type {
  InboxCaptureFilters as InboxCaptureFiltersState,
  InboxCaptureView,
  InboxReviewScope,
} from 'lib/inbox-capture-filters';
import { INBOX_LIST_TAGS, isInboxCaptureNode, parseInboxCapture } from 'lib/inbox-capture.utils';
import type { ParsedInboxCapture } from 'lib/inbox-capture.utils';
import { getInboxReviewState, withInboxReviewState } from 'lib/inbox-review.utils';
import { usePageTitle } from 'lib/use-page-title';

import styles from './inbox.module.css';

/** Stable query tags — avoid reallocating the tags array on every render. */
const INBOX_QUERY_TAGS: string[] = [...INBOX_LIST_TAGS];
const INBOX_NODES_STALE_MS = 30_000;

export function InboxPage() {
  usePageTitle('Inbox');

  const [searchParams, setSearchParams] = useSearchParams();
  const [confirmBatchArchive, setConfirmBatchArchive] = useState(false);
  const [confirmBatchDelete, setConfirmBatchDelete] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [brokenIds, setBrokenIds] = useState<Set<string>>(() => new Set());
  const [missingOnly, setMissingOnly] = useState(false);
  const filters = useMemo(() => parseInboxFiltersFromSearchParams(searchParams), [searchParams]);
  const batchUpdate = useBatchUpdateVaultNodes();
  const batchDelete = useDeleteVaultNodes();

  // Scope by node type so listNodes only scans ideas/resources — not the whole vault.
  // Search stays client-side (filterInboxCaptures); do not put `q` in the query key.
  const ideasQuery = useVaultNodes({
    type: 'idea',
    tags: INBOX_QUERY_TAGS,
    staleTime: INBOX_NODES_STALE_MS,
  });
  const resourcesQuery = useVaultNodes({
    type: 'resource',
    tags: INBOX_QUERY_TAGS,
    staleTime: INBOX_NODES_STALE_MS,
  });

  const nodes = useMemo(
    () => [...(ideasQuery.data ?? []), ...(resourcesQuery.data ?? [])],
    [ideasQuery.data, resourcesQuery.data],
  );
  const isLoading = ideasQuery.isLoading || resourcesQuery.isLoading;
  const isError = ideasQuery.isError || resourcesQuery.isError;
  const error = ideasQuery.error ?? resourcesQuery.error;

  const allCaptures = useMemo(() => nodes.filter(isInboxCaptureNode).map(parseInboxCapture), [nodes]);
  const filteredCaptures = useMemo(() => filterInboxCaptures(allCaptures, filters), [allCaptures, filters]);
  const visibleCaptures = useMemo(
    () =>
      missingOnly ? filteredCaptures.filter((capture) => brokenIds.has(capture.node.id)) : filteredCaptures,
    [filteredCaptures, missingOnly, brokenIds],
  );
  const groups = useMemo(
    () => groupInboxCaptures(visibleCaptures, filters.groupBy),
    [visibleCaptures, filters.groupBy],
  );
  const handleThumbnailBroken = (id: string) => {
    setBrokenIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  };
  const viewCounts = useMemo(
    () =>
      Object.fromEntries(
        INBOX_CAPTURE_VIEWS.map(({ value }) => [
          value,
          allCaptures.filter((capture) => matchesInboxCaptureView(capture, value)).length,
        ]),
      ) as Record<InboxCaptureView, number>,
    [allCaptures],
  );
  const reviewScopeCounts = useMemo(
    () =>
      ({
        unreviewed: allCaptures.filter((capture) => getInboxReviewState(capture.node) === 'new').length,
        reviewed: allCaptures.filter((capture) => getInboxReviewState(capture.node) === 'reviewed').length,
        both: allCaptures.length,
      }) satisfies Record<InboxReviewScope, number>,
    [allCaptures],
  );
  const statusOptions = useMemo(
    () => [...new Set(allCaptures.map((capture) => capture.node.status))].toSorted(),
    [allCaptures],
  );
  const reviewedVisible = useMemo(
    () => filteredCaptures.filter((capture) => getInboxReviewState(capture.node) === 'reviewed'),
    [filteredCaptures],
  );
  const newTodayCount = useMemo(
    () => allCaptures.filter((capture) => isToday(capture.receivedAt)).length,
    [allCaptures],
  );
  const needsAttentionCount = useMemo(
    () => allCaptures.filter(inboxCaptureNeedsAttention).length,
    [allCaptures],
  );
  const deletableVisible = useMemo(
    () =>
      visibleCaptures.filter((capture) => capture.node.type === 'idea' || capture.node.type === 'resource'),
    [visibleCaptures],
  );
  const selectedVisibleCount = deletableVisible.filter((capture) => selectedIds.has(capture.node.id)).length;
  const allVisibleSelected = deletableVisible.length > 0 && selectedVisibleCount === deletableVisible.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  const filteredIdKey = useMemo(
    () => visibleCaptures.map((capture) => capture.node.id).join('\0'),
    [visibleCaptures],
  );

  useEffect(() => {
    const visibleIds = new Set(filteredIdKey.length > 0 ? filteredIdKey.split('\0') : []);
    setSelectedIds((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (visibleIds.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [filteredIdKey]);

  const updateFilters = (next: InboxCaptureFiltersState) => {
    setSearchParams(inboxFiltersToSearchParams(next), { replace: true });
  };

  const applySummaryView = (view: InboxCaptureView) => {
    updateFilters({
      ...filters,
      view,
      routeKind: 'all',
      attention: 'all',
      reviewState: 'all',
    });
  };

  const toggleSelect = (id: string, selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const toggleSelectAllVisible = (selected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const capture of deletableVisible) {
        if (selected) next.add(capture.node.id);
        else next.delete(capture.node.id);
      }
      return next;
    });
  };

  const markReviewed = async (capture: ParsedInboxCapture) => {
    try {
      await batchUpdate.mutateAsync({
        ids: [capture.node.id],
        tags: withInboxReviewState(capture.node.tags, 'reviewed'),
      });
      toast.success('Marked reviewed — kept in Vault and available under Both or Reviewed.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update capture.');
    }
  };

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

  const deleteSelected = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    try {
      const result = await batchDelete.mutateAsync(ids);
      const scrubbedCount = result.scrubbedReferences.length;
      toast.success(
        scrubbedCount > 0
          ? `Deleted ${result.deleted.length} capture${result.deleted.length === 1 ? '' : 's'} and cleaned ${scrubbedCount} reference${scrubbedCount === 1 ? '' : 's'}.`
          : `Deleted ${result.deleted.length} capture${result.deleted.length === 1 ? '' : 's'}.`,
      );
      setSelectedIds(new Set());
      setConfirmBatchDelete(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete captures.');
    }
  };

  const busy = batchUpdate.isPending || batchDelete.isPending;

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Vault"
          title="Inbox"
          description="Captures from Telegram and other Hermes inbox drops."
          meta={
            <>
              {visibleCaptures.length} shown
              {visibleCaptures.length !== allCaptures.length ? ` · ${allCaptures.length} total` : null}
            </>
          }
          right={
            reviewedVisible.length > 0 ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setConfirmBatchArchive(true)}
              >
                Archive reviewed
                <Badge variant="outline">{reviewedVisible.length}</Badge>
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
          viewCounts={viewCounts}
          reviewScopeCounts={reviewScopeCounts}
          onChange={updateFilters}
        />

        <Row gutterWidth={8} align="center" className={styles.reviewHelp}>
          <Col xs={12}>
            <p className={styles.reviewHelpText}>
              <InfoIcon aria-hidden />
              <span>
                <strong>Reviewing completes Inbox triage only.</strong> The capture stays in Vault and Both;
                it leaves Needs attention. Archiving is a separate state. Neither action promotes it to
                knowledge.
              </span>
            </p>
          </Col>
        </Row>

        <Row gutterWidth={8} aria-label="Inbox summary" className={styles.summaryRow}>
          <Col xs={6} md={4} xl={2}>
            <SummaryMetric icon={Clock3Icon} value={newTodayCount} label="Captured today" />
          </Col>
          <Col xs={6} md={4} xl={2}>
            <SummaryMetric
              icon={TriangleAlertIcon}
              value={needsAttentionCount}
              label="Needs attention"
              tone="warning"
              active={filters.view === 'needs_attention'}
              onClick={() => applySummaryView('needs_attention')}
            />
          </Col>
          <Col xs={6} md={4} xl={2}>
            <SummaryMetric
              icon={ZapIcon}
              value={viewCounts.action_backed}
              label="Action-backed"
              active={filters.view === 'action_backed'}
              onClick={() => applySummaryView('action_backed')}
            />
          </Col>
          <Col xs={6} md={4} xl={2}>
            <SummaryMetric
              icon={FileQuestionIcon}
              value={viewCounts.raw}
              label="Raw / unknown"
              active={filters.view === 'raw'}
              onClick={() => applySummaryView('raw')}
            />
          </Col>
          <Col xs={6} md={4} xl={2}>
            <SummaryMetric
              icon={PaperclipIcon}
              value={viewCounts.attachments}
              label="Attachments"
              active={filters.view === 'attachments'}
              onClick={() => applySummaryView('attachments')}
            />
          </Col>
          <Col xs={6} md={4} xl={2}>
            <SummaryMetric
              icon={FileExclamationPointIcon}
              value={brokenIds.size}
              label="Missing"
              tone="danger"
              active={missingOnly}
              onClick={() => setMissingOnly((prev) => !prev)}
            />
          </Col>
        </Row>

        {deletableVisible.length > 0 ? (
          <Row gutterWidth={8} align="center" className={styles.selectionBar}>
            <Col xs="content">
              <Checkbox
                checked={allVisibleSelected ? true : someVisibleSelected ? 'indeterminate' : false}
                aria-label="Select all visible captures"
                onCheckedChange={(checked) => toggleSelectAllVisible(checked === true)}
              />
            </Col>
            <Col xs="content">
              <span className={styles.selectionLabel}>
                {selectedIds.size > 0
                  ? `${selectedIds.size} selected`
                  : `Select · ${deletableVisible.length} visible`}
              </span>
            </Col>
            <Col xs="content" className={styles.selectionActions}>
              {selectedIds.size > 0 ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => setSelectedIds(new Set())}
                  >
                    Clear
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={busy}
                    onClick={() => setConfirmBatchDelete(true)}
                  >
                    <TrashIcon aria-hidden />
                    Delete
                    <Badge variant="outline">{selectedIds.size}</Badge>
                  </Button>
                </>
              ) : null}
            </Col>
          </Row>
        ) : null}

        {groups.map((group) => {
          const list = (
            <InboxCaptureList
              captures={group.captures}
              loading={isLoading}
              error={isError ? (error instanceof Error ? error.message : 'Failed to load inbox.') : null}
              emptyMessage={
                allCaptures.length === 0
                  ? 'No Hermes inbox captures yet. Drop a link or note in Telegram to see it here.'
                  : 'No captures match the current filters.'
              }
              reviewPending={busy}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onMarkReviewed={(capture) => void markReviewed(capture)}
              brokenIds={brokenIds}
              onThumbnailBroken={handleThumbnailBroken}
            />
          );

          if (filters.groupBy === 'none') {
            return (
              <section key={group.key} className={styles.group}>
                {list}
              </section>
            );
          }

          return (
            <Collapsible key={group.key} defaultOpen className={styles.group}>
              <CollapsibleTrigger className={styles.groupTrigger}>
                <span className={styles.groupHeading}>{group.label}</span>
                <Badge variant="secondary" className={styles.groupCount}>
                  {group.captures.length}
                </Badge>
              </CollapsibleTrigger>
              <CollapsibleContent className={styles.groupContent}>{list}</CollapsibleContent>
            </Collapsible>
          );
        })}
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
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={() => {
                void archiveReviewed();
              }}
            >
              Archive reviewed
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmBatchDelete} onOpenChange={setConfirmBatchDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected captures?</AlertDialogTitle>
            <AlertDialogDescription>
              Permanently deletes {selectedIds.size} capture{selectedIds.size === 1 ? '' : 's'} from the vault
              and scrubs inbound related/tag/body references. Promoted resources are kept unless they only
              exist as dangling links.
              <span className="text-red-400"> This action cannot be undone.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                void deleteSelected();
              }}
            >
              {batchDelete.isPending ? 'Deleting…' : 'Delete captures'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}

function SummaryMetric({
  icon: Icon,
  value,
  label,
  active = false,
  tone = 'default',
  onClick,
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  active?: boolean;
  tone?: 'default' | 'warning' | 'danger';
  onClick?: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      className={styles.summaryCard}
      data-active={active || undefined}
      data-tone={tone}
      aria-disabled={!onClick}
      onClick={onClick}
    >
      <Icon aria-hidden />
      <span className={styles.summaryLabel}>{label}</span>
      <Badge variant="secondary" className={styles.summaryValue}>
        {value}
      </Badge>
    </Button>
  );
}

function isToday(timestamp: string): boolean {
  const date = new Date(timestamp);
  return !Number.isNaN(date.getTime()) && date.toDateString() === new Date().toDateString();
}
