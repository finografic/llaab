import { ChevronDownIcon, ChevronRightIcon, ExternalLinkIcon, UserCheckIcon, UserXIcon } from '@llaab/icons';
import { DeleteRunAction } from 'components/DeleteRunAction/DeleteRunAction';
import { DeleteRunGroupAction } from 'components/DeleteRunGroupAction/DeleteRunGroupAction';
import { ExtractionModelCard } from 'components/ExtractionModelCard';
import { Badge } from 'components/ui/badge';
import { TableCell, TableRow } from 'components/ui/table';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { getRunDisplayStatus, getRunElapsedDurationMs, isRunExtracting } from 'utils/run-display.utils';
import type { RunGroup } from 'utils/run-grouping.utils';

import styles from './RunsTable.module.css';
import { STATUS_CLASS, fmtDate, fmtDuration } from './RunsTableCells';

export interface RunGroupRowProps {
  group: RunGroup;
}

const RUN_GROUP_COLUMN_COUNT = 8;

/** Grouped row for the Runs table: a parent summary row plus collapsible per-run child rows. */
export function RunGroupRow({ group }: RunGroupRowProps) {
  const [expanded, setExpanded] = useState(true);
  const hasExtractingRun = useMemo(() => group.runs.some(isRunExtracting), [group.runs]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!hasExtractingRun) return undefined;

    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [hasExtractingRun]);

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
              {group.source.youtube_subscribed === true ? (
                <span className={`${styles.badge} ${styles.follow}`}>
                  <UserCheckIcon size={18} />
                </span>
              ) : group.source.youtube_subscribed === false ? (
                <span className={styles.muted}>
                  <UserXIcon size={18} />
                </span>
              ) : null}
              <Link to={`/vault/sources/${group.source.id}`} className={styles.authorLink}>
                {group.source.title}
              </Link>
            </div>
          ) : (
            <span className={styles.muted}>—</span>
          )}
        </TableCell>
        <TableCell className="text-center pt-3.5">
          <span className={styles.mono}>{group.avgNodes.toFixed(1)}</span>
        </TableCell>
        <TableCell className="text-center pt-3.5">
          <span className={styles.mono}>{fmtDuration(group.avgDurationMs)}</span>
        </TableCell>
        <TableCell className="text-center pt-3.5">
          <time className={styles.mono} dateTime={group.latestDate}>
            {fmtDate(group.latestDate)}
          </time>
        </TableCell>
        <TableCell className="text-center pr-0.5">
          {hasExtractingRun ? null : <DeleteRunGroupAction title={group.title} runs={group.runs} />}
        </TableCell>
      </TableRow>

      {/* Runs ------------------------------------------------------------- */}

      {expanded &&
        group.runs.map((run) => {
          const displayStatus = getRunDisplayStatus(run);
          const extracting = displayStatus === 'extracting';

          return (
            <TableRow key={run.id} className={styles.childRow}>
              <TableCell>
                <span className={`${styles.status} ${STATUS_CLASS[displayStatus]}`}>{displayStatus}</span>
              </TableCell>
              <TableCell colSpan={RUN_GROUP_COLUMN_COUNT - 1}>
                <div className={styles.childRowContent}>
                  <Link to={`/vault/runs/${run.id}`} className={`${styles.mono} ${styles.childRowId}`}>
                    {run.id}
                  </Link>
                  <div className={styles.childRowMeta}>
                    <ExtractionModelCard
                      variant="compact-bar"
                      model={run.llm?.model ?? run.model_used}
                      durationMs={getRunElapsedDurationMs(run, now)}
                      promptTokens={run.llm?.prompt_tokens}
                      completionTokens={run.llm?.completion_tokens}
                    />
                  </div>
                  {extracting ? null : <DeleteRunAction run={run} color="dim" />}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
    </>
  );
}
