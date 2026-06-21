import { DeleteRunAction } from 'components/DeleteRunAction/DeleteRunAction';
import { ExtractionModelCard } from 'components/ExtractionModelCard';
import { TableCell, TableRow } from 'components/ui/table';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { getRunDisplayStatus, getRunElapsedDurationMs, isRunExtracting } from 'utils/run-display.utils';
import type { RunGroup } from 'utils/run-grouping.utils';

import styles from './RunsTable.module.css';
import { STATUS_CLASS } from './RunsTable.utils';

export interface RunsGroupRowProps {
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

        return (
          <TableRow key={run.id} className={styles.childRow}>
            <TableCell className="pr-0">
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
              <span className={styles.nodesCell}>
                <span className={styles.mono}>{run.produced_node_ids.length}</span>
              </span>
            </TableCell>
            <TableCell className="text-right pr-4">
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
