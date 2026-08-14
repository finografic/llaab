import { CheckCircleIcon, XIcon } from '@llaab/icons';
import { DeleteRunAction } from 'components/DeleteRunAction/DeleteRunAction';
import { ExtractionModelCard } from 'components/ExtractionModelCard';
import { Spinner } from 'components/ui/spinner';
import { TableCell, TableRow } from 'components/ui/table';
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import type { RunDisplayStatus } from 'utils/run-display.utils';
import { getRunDisplayStatus, getRunElapsedDurationMs, isRunExtracting } from 'utils/run-display.utils';
import type { RunGroup } from 'utils/run-grouping.utils';

import { RunDetailLink } from './RunDetailLink';
import styles from './RunsTable.module.css';
import { STATUS_CLASS } from './RunsTable.utils';

export interface RunsGroupRowProps {
  group: RunGroup;
}

function renderRunStatusIcon(displayStatus: RunDisplayStatus): ReactNode {
  switch (displayStatus) {
    case 'completed':
      return (
        <span className={styles.statusIconSlot}>
          <CheckCircleIcon size={16} className={styles.statusCompletedIcon} aria-label="Completed" />
        </span>
      );
    case 'extracting':
      return (
        <span className={styles.statusIconSlot}>
          <Spinner className={styles.statusExtractingIcon} aria-label="Extracting" />
        </span>
      );
    case 'failed':
      return (
        <span className={styles.statusIconSlot}>
          <XIcon size={16} className={styles.statusFailedIcon} aria-label="Failed" />
        </span>
      );
    case 'pending':
    case 'running':
    case 'cancelled':
      return <span className={`${styles.status} ${STATUS_CLASS[displayStatus]}`}>{displayStatus}</span>;
    default: {
      const _exhaustive: never = displayStatus;
      return _exhaustive;
    }
  }
}

/** Grouped row for the Runs table: a parent summary row plus collapsible per-run child rows. */
export function RunsGroupRow({ group }: RunsGroupRowProps) {
  const hasExtractingRun = useMemo(() => group.runs.some(isRunExtracting), [group.runs]);
  const [now, setNow] = useState(() => Date.now());

  useEffect(
    function updateNow() {
      if (!hasExtractingRun) return undefined;

      setNow(Date.now());
      const interval = window.setInterval(() => setNow(Date.now()), 1000);
      return () => window.clearInterval(interval);
    },
    [hasExtractingRun],
  );

  return (
    <>
      {/* Runs ------------------------------------------------------------- */}
      {group.runs.map((run) => {
        const displayStatus = getRunDisplayStatus(run);
        const extracting = displayStatus === 'extracting';
        const model = run.llm?.model ?? run.model_used;
        const provider = run.llm?.provider;

        return (
          <TableRow key={run.id} className={styles.childRow}>
            <TableCell className="pr-0">{renderRunStatusIcon(displayStatus)}</TableCell>
            <TableCell>
              <div className={styles.childRowTitle}>
                <RunDetailLink run={run} className={`${styles.mono} ${styles.childRowId}`}>
                  {run.id}
                </RunDetailLink>
              </div>
            </TableCell>
            <TableCell className="text-center">
              <span className={styles.nodesCell}>
                <span className={styles.mono}>{run.produced_node_ids.length}</span>
              </span>
            </TableCell>
            <TableCell className="pr-1" colSpan={4}>
              <div className={styles.childRowModelMeta}>
                {/* Left under Date: provider + model only */}
                <ExtractionModelCard
                  variant="compact-bar"
                  provider={provider}
                  model={model}
                  className={`${styles.childRowModelChips} w-auto justify-start`}
                />
                {/* Right under Latency: tokens + duration only */}
                <ExtractionModelCard
                  variant="compact-bar"
                  showModel={false}
                  showTotalTokens={false}
                  durationMs={getRunElapsedDurationMs(run, now)}
                  promptTokens={run.llm?.prompt_tokens}
                  completionTokens={run.llm?.completion_tokens}
                  className={`${styles.childRowMetrics} w-auto justify-end`}
                />
              </div>
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
