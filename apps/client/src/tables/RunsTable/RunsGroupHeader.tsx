import {
  BadgeCheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  UserCheckIcon,
  UserXIcon,
} from '@llaab/icons';
import { DeleteRunGroupAction } from 'components/DeleteRunGroupAction/DeleteRunGroupAction';
import { Badge } from 'components/ui/badge';
import { TableCell, TableRow } from 'components/ui/table';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RunsGroupRow } from 'tables/RunsTable/RunsGroupRow';

import { isRunExtracting } from 'utils/run-display.utils';
import type { RunGroup } from 'utils/run-grouping.utils';

import styles from './RunsTable.module.css';
import { fmtClickDate, fmtDuration } from './RunsTable.utils';

export interface RunGroupRowProps {
  group: RunGroup;
}

/** Grouped row for the Runs table: a parent summary row plus collapsible per-run child rows. */
export function RunsGroupHeader({ group }: RunGroupRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasExtractingRun = useMemo(() => group.runs.some(isRunExtracting), [group.runs]);

  return (
    <>
      {/* Group Row -------------------------------------------------------- */}

      <TableRow className={styles.groupRow}>
        <TableCell>
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
        <TableCell>
          <div className={styles.cellTitle}>
            {group.href ? (
              <Link to={group.href} className={styles.subjectTitle}>
                {group.title}
              </Link>
            ) : (
              <span className={styles.subjectTitle}>{group.title}</span>
            )}
          </div>
        </TableCell>
        <TableCell>
          {group.publishedAt ? (
            <time className={styles.mono} dateTime={group.publishedAt}>
              {fmtClickDate(group.publishedAt)}
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
        <TableCell>
          {group.source ? (
            <div className={styles.authorCell}>
              {group.source.youtube_subscribed ? (
                <span className={styles.follow}>
                  <UserCheckIcon size={18} />
                </span>
              ) : (
                <span className={styles.muted}>
                  <UserXIcon size={18} />
                </span>
              )}
              <Link to={`/vault/sources/${group.source.id}`} className={styles.authorLink}>
                {group.source.title}
              </Link>
            </div>
          ) : (
            <span className={styles.muted}>—</span>
          )}
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
        <TableCell className="text-right pt-3.5 pr-1">
          <span className={styles.mono}>~ {fmtDuration(group.avgDurationMs)}</span>
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
