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
import { STATUS_CLASS, fmtClickDate, fmtDuration } from './RunsTableCells';

export interface RunGroupRowProps {
  group: RunGroup;
}

function RunModelBadge({ model }: { model?: string }) {
  if (!model) return null;

  return (
    <span className="rounded-full border border-border bg-muted/30 px-2 py-0.5 font-mono text-xs text-muted-foreground">
      {model}
    </span>
  );
}

/** Grouped row for the Runs table: a parent summary row plus collapsible per-run child rows. */
export function RunGroupRow({ group }: RunGroupRowProps) {
  const [expanded, setExpanded] = useState(false);
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
          <span className={styles.mono}>{group.totalNodes}</span>
        </TableCell>
        <TableCell className="text-right pt-3.5 pr-1">
          <span className={styles.mono}>~ {fmtDuration(group.avgDurationMs)}</span>
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
          const model = run.llm?.model ?? run.model_used;

          return (
            <TableRow key={run.id} className={styles.childRow}>
              <TableCell>
                <span className={`${styles.status} ${STATUS_CLASS[displayStatus]}`}>{displayStatus}</span>
              </TableCell>
              <TableCell>
                <div className={styles.childRowTitle}>
                  <Link to={`/vault/runs/${run.id}`} className={`${styles.mono} ${styles.childRowId}`}>
                    {run.id}
                  </Link>
                </div>
              </TableCell>
              <TableCell className="pl-1.5" colSpan={3}>
                <RunModelBadge model={model} />
              </TableCell>
              <TableCell className="text-center">
                <span className={styles.mono}>{run.produced_node_ids.length}</span>
              </TableCell>
              <TableCell className="text-right pr-0">
                <ExtractionModelCard
                  variant="compact-bar"
                  showModel={false}
                  showTotalTokens={false}
                  durationMs={getRunElapsedDurationMs(run, now)}
                  promptTokens={run.llm?.prompt_tokens}
                  completionTokens={run.llm?.completion_tokens}
                  className={styles.childRowMetrics}
                />
              </TableCell>
              <TableCell className="text-center pr-0.5">
                {extracting ? null : <DeleteRunAction run={run} color="dim" />}
              </TableCell>
            </TableRow>
          );
        })}
    </>
  );
}
