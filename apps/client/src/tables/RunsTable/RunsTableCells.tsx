import { DeleteRunAction } from 'components/DeleteRunAction/DeleteRunAction';
import { ExternalLinkIcon, UserCheckIcon, UserXIcon } from 'lucide-react';
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

import styles from './RunsTable.module.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(ms?: number): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_CLASS: Record<RunNode['run_status'], string> = {
  pending: styles.statusPending,
  running: styles.statusRunning,
  completed: styles.statusCompleted,
  failed: styles.statusFailed,
  cancelled: styles.statusCancelled,
};

// ─── Cells ──────────────────────────────────────────────────────────────────

function getRunInputUrl(run: RunNode): string | undefined {
  return run.input_summary ? extractMetadataUrl(run.input_summary) : undefined;
}

export function renderRunTitleCell({ row }: CellContext<RunNode, unknown>) {
  const run = row.original;
  const subjectTitle = extractRunSubjectTitle(run);
  const subjectHref = extractRunSubjectHref(run);

  return (
    <div className={styles.cellTitle}>
      {subjectTitle && !subjectHref && <span className={styles.subjectTitle}>{subjectTitle}</span>}
      <Link to={`/vault/runs/${run.id}`} className={styles.runLabel}>
        {run.title}
      </Link>
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

export function renderRunAuthorCell(run: RunNode, sourcesById: Map<string, SourceNode>) {
  const sourceId = extractRunSourceId(run);
  const source = sourceId ? sourcesById.get(sourceId) : undefined;
  const author = extractRunAuthor(run) ?? source?.title;
  const following = source?.youtube_subscribed;

  if (!author && following == null) {
    return <span className={styles.muted}>—</span>;
  }

  return (
    <div className={styles.authorCell}>
      {following === true ? (
        <span className={`${styles.badge} ${styles.follow}`}>
          <UserCheckIcon size={18} />
        </span>
      ) : following === false ? (
        <span className={styles.muted}>
          <UserXIcon size={18} />
        </span>
      ) : null}
      {author &&
        (sourceId ? (
          <Link to={`/vault/sources/${sourceId}`} className={styles.authorLink}>
            {author}
          </Link>
        ) : (
          <span className={styles.authorName}>{author}</span>
        ))}
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
