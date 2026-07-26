import { DeleteInboxCaptureAction } from 'components/DeleteInboxCaptureAction/DeleteInboxCaptureAction';
import { Badge } from 'components/ui/badge';
import { Button } from 'components/ui/button';
import { Checkbox } from 'components/ui/checkbox';
import { Col, Row } from 'components/ui/grid';
import {
  BookmarkCheckIcon,
  BookmarkIcon,
  ClipboardIcon,
  ExternalLinkIcon,
  FileCode2Icon,
  FileExclamationPointIcon,
  FileIcon,
  FileTextIcon,
  ImageIcon,
  LinkIcon,
  ListTodoIcon,
  PackageIcon,
  SquareTerminalIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import type { LucideIcon } from 'lucide-react';

import { getInboxListRowRenderer } from 'lib/inbox-capture-renderers';
import type { ParsedInboxCapture } from 'lib/inbox-capture.utils';
import { routeKindLabel } from 'lib/inbox-capture.utils';
import { getInboxReviewState } from 'lib/inbox-review.utils';
import { formatCompactDateTime } from 'utils/format-date.utils';

import { getInboxCaptureListPresentation } from './inbox-capture-list.utils';
import styles from './InboxCaptureList.module.css';

export interface InboxCaptureListProps {
  captures: ParsedInboxCapture[];
  loading?: boolean;
  error?: string | null;
  selectedId?: string;
  emptyMessage?: string;
  reviewPending?: boolean;
  selectedIds?: ReadonlySet<string>;
  onToggleSelect?: (id: string, selected: boolean) => void;
  onMarkReviewed?: (capture: ParsedInboxCapture) => void;
  onUnmarkReviewed?: (capture: ParsedInboxCapture) => void;
  brokenIds?: ReadonlySet<string>;
  onThumbnailBroken?: (id: string) => void;
}

export function InboxCaptureList({
  captures,
  loading = false,
  error = null,
  selectedId,
  emptyMessage = 'No inbox captures yet.',
  reviewPending = false,
  selectedIds,
  onToggleSelect,
  onMarkReviewed,
  onUnmarkReviewed,
  brokenIds,
  onThumbnailBroken,
}: InboxCaptureListProps) {
  if (loading) {
    return <p className={styles.state}>Loading inbox captures…</p>;
  }

  if (error) {
    return (
      <div className={styles.errorState} role="alert">
        <TriangleAlertIcon aria-hidden />
        <div>
          <strong>Inbox could not be loaded</strong>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (captures.length === 0) {
    return <p className={styles.empty}>{emptyMessage}</p>;
  }

  return (
    <div className={styles.list}>
      {captures.map((capture) => {
        const CustomRow = getInboxListRowRenderer(capture.routeKind);
        if (CustomRow) {
          return (
            <CustomRow key={capture.node.id} capture={capture} selected={selectedId === capture.node.id} />
          );
        }

        return (
          <DefaultInboxCaptureListRow
            key={capture.node.id}
            capture={capture}
            selected={selectedId === capture.node.id}
            reviewPending={reviewPending}
            checked={selectedIds?.has(capture.node.id) ?? false}
            onCheckedChange={
              onToggleSelect ? (checked) => onToggleSelect(capture.node.id, checked === true) : undefined
            }
            onMarkReviewed={onMarkReviewed}
            onUnmarkReviewed={onUnmarkReviewed}
            broken={brokenIds?.has(capture.node.id) ?? false}
            onThumbnailBroken={onThumbnailBroken}
          />
        );
      })}
    </div>
  );
}

function DefaultInboxCaptureListRow({
  capture,
  selected = false,
  reviewPending,
  checked,
  onCheckedChange,
  onMarkReviewed,
  onUnmarkReviewed,
  broken,
  onThumbnailBroken,
}: {
  capture: ParsedInboxCapture;
  selected?: boolean;
  reviewPending: boolean;
  checked: boolean;
  onCheckedChange?: (checked: boolean | 'indeterminate') => void;
  onMarkReviewed?: (capture: ParsedInboxCapture) => void;
  onUnmarkReviewed?: (capture: ParsedInboxCapture) => void;
  broken: boolean;
  onThumbnailBroken?: (id: string) => void;
}) {
  const { node, routeKind, platform, receivedAt, malformed } = capture;
  const reviewState = getInboxReviewState(node);
  const presentation = getInboxCaptureListPresentation(capture);
  const RouteIcon = inboxRouteIcon(routeKind);
  const displayTags = node.tags.filter(isDisplayTag).slice(0, 2);
  const selectable = Boolean(onCheckedChange) && (node.type === 'idea' || node.type === 'resource');

  const copyCapture = async () => {
    if (!presentation.copyText) return;
    try {
      await navigator.clipboard.writeText(presentation.copyText);
      toast.success(presentation.isCommand ? 'Command copied as a reference' : 'Capture copied');
    } catch {
      toast.error('Could not copy capture.');
    }
  };

  return (
    <article
      className={`${styles.row}${selected ? ` ${styles.rowSelected}` : ''}${checked ? ` ${styles.rowChecked}` : ''}`}
      data-review-state={reviewState}
      data-route-kind={routeKind}
    >
      <Row nogutter align="center">
        {onCheckedChange ? (
          <Col xs="content" className={styles.selectCol}>
            <Checkbox
              className={styles.selectionCheckbox}
              checked={checked}
              disabled={!selectable}
              aria-label={`Select ${node.title || 'capture'}`}
              onCheckedChange={onCheckedChange}
              onClick={(event) => event.stopPropagation()}
            />
          </Col>
        ) : null}

        <Col xs="content" className={styles.reviewCol}>
          {reviewState === 'new' || reviewState === 'failed' ? (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className={styles.reviewActionPending}
              title="Mark reviewed — keeps this capture in Vault and removes it from Needs attention"
              aria-label="Mark reviewed; keep in Vault and remove from Needs attention"
              disabled={reviewPending || !onMarkReviewed}
              onClick={() => onMarkReviewed?.(capture)}
            >
              <BookmarkIcon aria-hidden />
            </Button>
          ) : reviewState === 'reviewed' ? (
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className={styles.reviewActionDone}
              title="Reviewed — click to mark unreviewed"
              aria-label="Reviewed; mark unreviewed"
              disabled={reviewPending || !onUnmarkReviewed}
              onClick={() => onUnmarkReviewed?.(capture)}
            >
              <BookmarkCheckIcon aria-hidden />
            </Button>
          ) : null}
        </Col>

        <Col xs={12} lg={5} className={styles.primaryCol}>
          <Link to={`/vault/inbox/${node.id}`} className={styles.primaryLink}>
            <span className={styles.visual} aria-hidden data-broken={broken || undefined}>
              {presentation.imageUrl && !broken ? (
                <img
                  src={presentation.imageUrl}
                  alt=""
                  className={styles.thumbnail}
                  onError={() => onThumbnailBroken?.(node.id)}
                />
              ) : broken ? (
                <FileExclamationPointIcon />
              ) : (
                <RouteIcon />
              )}
            </span>
            <span className={styles.content}>
              <span className={styles.title}>{node.title || 'Untitled capture'}</span>
              <span className={`${styles.summary}${presentation.isCode ? ` ${styles.codeSummary}` : ''}`}>
                {presentation.summary}
              </span>
              {presentation.secondary ? (
                <span className={styles.secondary}>{presentation.secondary}</span>
              ) : null}
              {presentation.isCommand ? (
                <span className={styles.commandNotice}>Reference only · not executable</span>
              ) : null}
              {malformed ? <span className={styles.malformed}>Malformed provenance JSON</span> : null}
            </span>
          </Link>
        </Col>

        <Col xs={6} sm={4} lg={2} className={styles.metaCol}>
          <div className={styles.badges}>
            <Badge variant="secondary" className={styles.kindBadge}>
              {routeKindLabel(routeKind)}
            </Badge>
            {broken ? (
              <Badge variant="outline" className={styles.missingBadge}>
                Missing
              </Badge>
            ) : null}
            {presentation.language ? <Badge variant="outline">{presentation.language}</Badge> : null}
            {displayTags.map((tag) => (
              <Badge key={tag} variant="outline" className={styles.captureTag} data-tag={tag}>
                {tag}
              </Badge>
            ))}
          </div>
        </Col>

        <Col xs={6} sm={4} lg={2} className={styles.metaCol}>
          <div className={styles.stateMeta}>
            <div className={styles.badges}>
              <Badge variant="outline" className={styles.platformBadge} data-platform={platform}>
                {platform}
              </Badge>
              <Badge variant="outline" data-review-state={reviewState} className={styles.reviewBadge}>
                {reviewState}
              </Badge>
            </div>
            <time className={styles.date} dateTime={receivedAt}>
              {formatCompactDateTime(receivedAt)}
            </time>
          </div>
        </Col>

        <Col xs={12} sm={4} lg={1} className={styles.actionsCol}>
          <div className={styles.actions}>
            {presentation.sourceUrl ? (
              <Button asChild type="button" size="icon-sm" variant="ghost" title="Open source">
                <a href={presentation.sourceUrl} target="_blank" rel="noreferrer" aria-label="Open source">
                  <ExternalLinkIcon aria-hidden />
                </a>
              </Button>
            ) : null}
            {presentation.copyText ? (
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className={styles.copyAction}
                title={presentation.isCommand ? 'Copy command reference' : 'Copy capture'}
                aria-label={presentation.isCommand ? 'Copy command reference' : 'Copy capture'}
                onClick={() => void copyCapture()}
              >
                <ClipboardIcon aria-hidden />
              </Button>
            ) : null}
            {node.type === 'idea' || node.type === 'resource' ? (
              <DeleteInboxCaptureAction capture={capture} color="dim" />
            ) : null}
          </div>
        </Col>
      </Row>
    </article>
  );
}

function inboxRouteIcon(routeKind: string): LucideIcon {
  switch (routeKind) {
    case 'todo':
      return ListTodoIcon;
    case 'image':
      return ImageIcon;
    case 'code_snippet':
    case 'code_link':
    case 'code_attachment':
      return FileCode2Icon;
    case 'command_candidate':
      return SquareTerminalIcon;
    case 'docs_link':
    case 'post_link':
    case 'docs_attachment':
      return FileTextIcon;
    case 'npm_package':
    case 'github_repo':
      return PackageIcon;
    case 'web_link':
    case 'youtube_url':
      return LinkIcon;
    default:
      return FileIcon;
  }
}

function isDisplayTag(tag: string): boolean {
  return tag !== 'hermes' && tag !== 'inbox' && !tag.startsWith('inbox:');
}
