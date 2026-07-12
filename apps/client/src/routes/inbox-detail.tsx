import { InboxCaptureDetail } from 'components/InboxCaptureDetail/InboxCaptureDetail';
import { PageHero } from 'components/PageHero/PageHero';
import { useSecondaryBackAction } from 'layouts/AppLayout/SecondaryActionBarContext';
import { PageDetail } from 'layouts/PageDetail/PageDetail';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { useVaultNode } from 'queries/vault';
import { Link, Navigate, useParams } from 'react-router-dom';

import { isInboxCaptureNode, parseInboxCapture, routeKindLabel } from 'lib/inbox-capture.utils';
import { usePageTitle } from 'lib/use-page-title';
import { formatDetailDate } from 'utils/format-date.utils';

export function InboxDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: node, isLoading, isError, error } = useVaultNode(id);

  usePageTitle(node?.title ?? 'Inbox capture');
  useSecondaryBackAction('/vault/inbox', 'Back to inbox');

  if (!id) return <Navigate to="/vault/inbox" replace />;
  if (!isLoading && !node) return <Navigate to="/vault/inbox" replace />;

  if (!node) {
    return (
      <PageLayout hero={<PageHero eyebrow="Vault" title="Loading…" />}>
        <p className="text-muted-foreground text-sm">Loading inbox capture…</p>
      </PageLayout>
    );
  }

  if (isError) {
    return (
      <PageLayout hero={<PageHero eyebrow="Vault" title="Inbox capture" />}>
        <p className="text-destructive text-sm">
          {error instanceof Error ? error.message : 'Failed to load inbox capture.'}
        </p>
      </PageLayout>
    );
  }

  if (!isInboxCaptureNode(node)) {
    return <Navigate to={`/vault/nodes/${node.id}`} replace />;
  }

  const capture = parseInboxCapture(node);

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Vault"
          title={node.title || 'Untitled capture'}
          meta={
            <>
              <span className="badge badge--idea">{routeKindLabel(capture.routeKind)}</span>
              <span className={`badge badge--status badge--${node.status}`}>{node.status}</span>
              <span className="meta-sep">·</span>
              <span className="meta-text">{formatDetailDate(capture.receivedAt)}</span>
              <span className="meta-sep">·</span>
              <Link to="/vault/inbox" className="meta-link">
                Back to inbox
              </Link>
            </>
          }
        />
      }
    >
      <PageDetail variant="narrow">
        <InboxCaptureDetail capture={capture} />
      </PageDetail>
    </PageLayout>
  );
}
