import { BadgeCheckIcon, ChevronDownIcon, ChevronRightIcon, ExternalLinkIcon } from '@llaab/icons';
import { resolveDataTableMaxWidth, truncateChars } from '@llaab/ui/lib/data-table-utils';
import { DeleteRunGroupAction } from 'components/DeleteRunGroupAction/DeleteRunGroupAction';
import { Badge } from 'components/ui/badge';
import { TableCell, TableRow } from 'components/ui/table';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RunsGroupRow } from 'tables/RunsTable/RunsGroupRow';
import type { DataTableColumnLimit } from '@llaab/ui/lib/data-table-utils';

import { cn } from 'lib/utils';
import { extractRunAuthor, extractRunSourceId } from 'utils/metadata-rendering.utils';
import { isRunExtracting } from 'utils/run-display.utils';
import type { RunGroup } from 'utils/run-grouping.utils';

import styles from './RunsTable.module.css';
import { fmtClickDate, fmtDuration, renderYouTubeSubscriptionIcon } from './RunsTable.utils';

const AUTHOR_COLUMN_MAX_WIDTH = '250px';

export interface RunGroupRowProps {
  group: RunGroup;
  titleLimits?: DataTableColumnLimit;
  dateMode: 'ingested' | 'published';
}

/** Grouped row for the Runs table: a parent summary row plus collapsible per-run child rows. */
export function RunsGroupHeader({ group, titleLimits, dateMode }: RunGroupRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasExtractingRun = useMemo(() => group.runs.some(isRunExtracting), [group.runs]);
  const displayTitle = titleLimits?.maxChars ? truncateChars(group.title, titleLimits.maxChars) : group.title;
  const titleCellStyle = titleLimits?.maxWidth
    ? { maxWidth: resolveDataTableMaxWidth(titleLimits.maxWidth) }
    : undefined;
  const truncatedTitleClass = titleLimits ? styles.subjectTitleTruncated : undefined;
  const primaryRun = group.runs[0];
  const authorSourceId = group.source?.id ?? (primaryRun ? extractRunSourceId(primaryRun) : undefined);
  const authorLabel = group.source?.title ?? (primaryRun ? extractRunAuthor(primaryRun) : undefined);
  const authorSourceIcon = renderYouTubeSubscriptionIcon(group.source);
  const authorNameClass = authorSourceIcon
    ? styles.authorLink
    : `${styles.authorLink} ${styles.authorNoIcon}`;
  const authorPlainNameClass = authorSourceIcon
    ? styles.authorName
    : `${styles.authorName} ${styles.authorNoIcon}`;
  const displayDate = dateMode === 'published' ? group.publishedAt : group.latestDate;

  return (
    <>
      {/* Group Row -------------------------------------------------------- */}

      <TableRow className={styles.groupRow}>
        <TableCell className="pr-0">
          <button
            type="button"
            className={styles.groupToggle}
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse runs' : 'Expand runs'}
          >
            {expanded ? (
              <ChevronDownIcon size={16} aria-hidden />
            ) : (
              <ChevronRightIcon size={16} aria-hidden />
            )}
            <Badge variant="outline" className={styles.runsBadge}>
              {group.runs.length}
            </Badge>
          </button>
        </TableCell>
        <TableCell style={titleCellStyle}>
          <div className={styles.cellTitle}>
            {group.href ? (
              <Link
                to={group.href}
                className={cn(styles.subjectTitle, truncatedTitleClass)}
                title={group.title}
              >
                {displayTitle}
              </Link>
            ) : (
              <span className={cn(styles.subjectTitle, truncatedTitleClass)} title={group.title}>
                {displayTitle}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell className="text-center pt-3.5">
          <span className={styles.nodesCell}>
            {group.isConsolidated ? (
              <BadgeCheckIcon
                size={14}
                className={styles.consolidatedIcon}
                aria-label="Canonical ideas consolidated"
              />
            ) : (
              <span aria-hidden className={styles.consolidatedIconPlaceholder} />
            )}
            <span className={styles.mono}>{group.totalNodes}</span>
          </span>
        </TableCell>
        <TableCell>
          {displayDate ? (
            <time className={styles.mono} dateTime={displayDate}>
              {fmtClickDate(displayDate)}
            </time>
          ) : (
            <span className={styles.muted}>—</span>
          )}
        </TableCell>
        <TableCell>
          {group.url ? (
            <a
              href={group.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.sourceLink}
              aria-label={group.url}
            >
              <ExternalLinkIcon size={18} aria-hidden />
            </a>
          ) : (
            <span className={styles.muted}>—</span>
          )}
        </TableCell>
        <TableCell style={{ maxWidth: AUTHOR_COLUMN_MAX_WIDTH }}>
          {authorLabel ? (
            <div className={styles.authorCell}>
              {authorSourceIcon}
              {authorSourceId ? (
                <Link to={`/vault/sources/${authorSourceId}`} className={authorNameClass} title={authorLabel}>
                  {authorLabel}
                </Link>
              ) : (
                <span className={authorPlainNameClass} title={authorLabel}>
                  {authorLabel}
                </span>
              )}
            </div>
          ) : (
            <span className={styles.muted}>—</span>
          )}
        </TableCell>
        <TableCell className="text-right pt-3.5 pr-1">
          <span className={`${styles.mono} ${styles.latencyValue}`}>
            ~ {fmtDuration(group.avgDurationMs)}
          </span>
        </TableCell>
        <TableCell className="text-center pr-0.5">
          {hasExtractingRun ? null : <DeleteRunGroupAction title={group.title} runs={group.runs} />}
        </TableCell>
      </TableRow>

      {/* Runs ------------------------------------------------------------- */}

      {expanded && <RunsGroupRow group={group} />}
    </>
  );
}
