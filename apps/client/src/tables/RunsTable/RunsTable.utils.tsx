import { DeleteRunAction } from 'components/DeleteRunAction/DeleteRunAction';
import { ExternalLinkIcon, MicIcon, UserCheckIcon, UserXIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { RunNode, SourceNode } from '@llaab/schemas';
import type { CellContext } from '@tanstack/react-table';

import {
  extractMetadataUrl,
  extractRunAuthor,
  extractRunSourceId,
  extractRunSubjectHref,
  extractRunSubjectTitle,
} from 'utils/metadata-rendering.utils';
import type { RunDisplayStatus } from 'utils/run-display.utils';
import { isPodcastSource, isYouTubeChannelSource } from 'utils/youtube-source.utils';

import { RunDetailLink } from './RunDetailLink';
import styles from './RunsTable.module.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function fmtDuration(ms?: number): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Dd-MM-YYYY — source publish date in grouped run headers. */
export function fmtClickDate(iso: string): string {
  const date = new Date(iso);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
}

export const STATUS_CLASS: Record<RunDisplayStatus, string> = {
  pending: styles.statusPending,
  running: styles.statusRunning,
  extracting: styles.statusExtracting,
  completed: styles.statusCompleted,
  failed: styles.statusFailed,
  cancelled: styles.statusCancelled,
};

// ─── Cells ──────────────────────────────────────────────────────────────────

export function getRunInputUrl(run: RunNode): string | undefined {
  return run.input_summary ? extractMetadataUrl(run.input_summary) : undefined;
}

export function renderRunTitleCell({ row }: CellContext<RunNode, unknown>) {
  const run = row.original;
  const subjectTitle = extractRunSubjectTitle(run);
  const subjectHref = extractRunSubjectHref(run);

  return (
    <div className={styles.cellTitle}>
      {subjectTitle && !subjectHref && <span className={styles.subjectTitle}>{subjectTitle}</span>}
      <RunDetailLink run={run} className={styles.runLabel}>
        {run.title}
      </RunDetailLink>
      {subjectTitle && subjectHref && (
        <a href={subjectHref} className={styles.subjectTitle}>
          {subjectTitle}
        </a>
      )}
    </div>
  );
}

export function renderRunSourceCell({ row }: CellContext<RunNode, unknown>) {
  const inputUrl = getRunInputUrl(row.original);

  if (!inputUrl) {
    return <span className={styles.muted}>—</span>;
  }

  return (
    <a
      href={inputUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.sourceLink}
      aria-label={inputUrl}
    >
      <ExternalLinkIcon size={18} aria-hidden />
    </a>
  );
}

export function renderYouTubeSubscriptionIcon(source: SourceNode | undefined) {
  if (!source) return null;

  if (isPodcastSource(source)) {
    return (
      <span className={styles.podcastSource} title="Podcast" aria-label="Podcast">
        <MicIcon size={18} aria-hidden />
      </span>
    );
  }

  if (!isYouTubeChannelSource(source)) return null;

  if (source.youtube_subscribed === true) {
    return (
      <span className={styles.follow} title="Subscribed on YouTube" aria-label="Subscribed on YouTube">
        <UserCheckIcon size={18} aria-hidden />
      </span>
    );
  }

  const title =
    source.youtube_subscribed === false ? 'Not subscribed on YouTube' : 'YouTube subscription status unknown';

  return (
    <span className={styles.notSubscribed} title={title} aria-label={title}>
      <UserXIcon size={18} aria-hidden />
    </span>
  );
}

export function renderRunAuthorCell(run: RunNode, sourcesById: Map<string, SourceNode>) {
  const sourceId = extractRunSourceId(run);
  const source = sourceId ? sourcesById.get(sourceId) : undefined;
  const author = extractRunAuthor(run) ?? source?.title;

  if (!author) {
    return <span className={styles.muted}>—</span>;
  }

  const sourceIcon = renderYouTubeSubscriptionIcon(source);
  const nameClass = sourceIcon ? styles.authorLink : `${styles.authorLink} ${styles.authorNoIcon}`;
  const plainNameClass = sourceIcon ? styles.authorName : `${styles.authorName} ${styles.authorNoIcon}`;

  return (
    <div className={styles.authorCell}>
      {sourceIcon}
      {sourceId ? (
        <Link to={`/vault/sources/${sourceId}`} className={nameClass}>
          {author}
        </Link>
      ) : (
        <span className={plainNameClass}>{author}</span>
      )}
    </div>
  );
}

export function renderRunStatusCell({ getValue }: CellContext<RunNode, unknown>) {
  const status = getValue<RunNode['run_status']>();
  return <span className={`${styles.status} ${STATUS_CLASS[status]}`}>{status}</span>;
}

export function renderRunProducedCell({ getValue }: CellContext<RunNode, unknown>) {
  return <span className={styles.mono}>{getValue<number>()}</span>;
}

export function renderRunDurationCell({ getValue }: CellContext<RunNode, unknown>) {
  return <span className={styles.mono}>{fmtDuration(getValue<number | undefined>())}</span>;
}

export function renderRunDateCell({ getValue }: CellContext<RunNode, unknown>) {
  const createdAt = getValue<string>();
  return (
    <time className={styles.mono} dateTime={createdAt}>
      {fmtDate(createdAt)}
    </time>
  );
}

export function renderRunActionsCell({ row }: CellContext<RunNode, unknown>) {
  return <DeleteRunAction run={row.original} />;
}

export function buildSourcesById(sources: SourceNode[]): Map<string, SourceNode> {
  return new Map(sources.map((source) => [source.id, source]));
}
