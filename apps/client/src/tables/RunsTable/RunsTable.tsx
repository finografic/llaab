import { resolveDataTableMaxWidth } from '@llaab/ui/lib/data-table-utils';
import { Button } from 'components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from 'components/ui/table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useRunMonitor, useRuns } from 'queries/runs';
import { useMemo, useState } from 'react';
import { RunsGroupHeader } from 'tables/RunsTable/RunsGroupHeader';
import { buildSourcesById } from 'tables/RunsTable/RunsTable.utils';
import type { RunNode, SourceNode, TranscriptNode } from '@llaab/schemas';
import type { DataTableColumnLimit } from '@llaab/ui/lib/data-table-utils';
import type { CSSProperties, ReactNode } from 'react';

import { isIngestRun, isRunExtracting } from 'utils/run-display.utils';
import type { RunGroup } from 'utils/run-grouping.utils';
import { groupRunsBySubject } from 'utils/run-grouping.utils';

import styles from './RunsTable.module.css';

// ─── Component ────────────────────────────────────────────────────────────────

/** Matches useRunMonitor's own active-poll cadence — no reason to refetch the list faster. */
const ACTIVE_POLL_INTERVAL_MS = 2500;

type SortDirection = 'asc' | 'desc';
type SortColumn = 'title' | 'date' | 'author' | 'nodes' | 'latency';

interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

function compareStrings(a: string, b: string, direction: SortDirection): number {
  const cmp = a.localeCompare(b);
  return direction === 'asc' ? cmp : -cmp;
}

function compareNumbers(a: number, b: number, direction: SortDirection): number {
  const cmp = a - b;
  return direction === 'asc' ? cmp : -cmp;
}

function compareGroups(a: RunGroup, b: RunGroup, sort: SortState): number {
  switch (sort.column) {
    case 'title':
      return compareStrings(a.title, b.title, sort.direction);
    case 'date':
      return compareStrings(a.publishedAt ?? '', b.publishedAt ?? '', sort.direction);
    case 'author':
      return compareStrings(a.source?.title ?? '', b.source?.title ?? '', sort.direction);
    case 'nodes':
      return compareNumbers(a.totalNodes, b.totalNodes, sort.direction);
    case 'latency':
      return compareNumbers(a.avgDurationMs ?? -1, b.avgDurationMs ?? -1, sort.direction);
    default: {
      const exhaustive: never = sort.column;
      return exhaustive;
    }
  }
}

export interface RunsTableProps {
  sources?: SourceNode[];
  transcripts?: TranscriptNode[];
  showHeading?: boolean;
  skillIds?: readonly string[];
  /** Per-column truncation limits (e.g. title on the ingest page). */
  columnLimits?: Partial<Record<SortColumn, DataTableColumnLimit>>;
}

function SortableHeader({
  column,
  sort,
  onSort,
  className,
  style,
  children,
}: {
  column: SortColumn;
  sort: SortState;
  onSort: (column: SortColumn) => void;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const isActive = sort.column === column;
  const Icon = isActive ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <TableHead className={className} style={style}>
      <Button
        variant="ghost"
        className={isActive ? 'text-foreground' : 'text-muted-foreground opacity-70'}
        onClick={() => onSort(column)}
      >
        {children}
        <Icon />
      </Button>
    </TableHead>
  );
}

export function RunsTable({
  sources = [],
  transcripts = [],
  showHeading = false,
  skillIds,
  columnLimits,
}: RunsTableProps) {
  const [sort, setSort] = useState<SortState>({ column: 'date', direction: 'desc' });
  const { data: monitorData } = useRunMonitor();
  const monitorRunIds = useMemo(
    () => new Set([...(monitorData?.active ?? []), ...(monitorData?.recent ?? [])].map((run) => run.id)),
    [monitorData?.active, monitorData?.recent],
  );
  const { data: allRuns = [] } = useRuns({
    refetchInterval: (query) => {
      const data = query.state.data ?? [];
      const hasMonitorRunMissingFromList = [...monitorRunIds].some(
        (runId) => !data.some((run) => run.id === runId),
      );
      if ((monitorData?.active.length ?? 0) > 0 || hasMonitorRunMissingFromList) {
        return ACTIVE_POLL_INTERVAL_MS;
      }
      return data.some(isRunExtracting) ? ACTIVE_POLL_INTERVAL_MS : false;
    },
  });

  const skillIdSet = useMemo(() => (skillIds ? new Set(skillIds) : null), [skillIds]);
  const runs = useMemo(
    () =>
      allRuns.filter((run): run is RunNode => {
        if (!isIngestRun(run)) return false;
        return skillIdSet ? skillIdSet.has(run.skill_id ?? '') : true;
      }),
    [allRuns, skillIdSet],
  );
  const sourcesById = useMemo(() => buildSourcesById(sources), [sources]);
  const transcriptsById = useMemo(
    () => new Map(transcripts.map((transcript) => [transcript.id, transcript])),
    [transcripts],
  );
  const groups = useMemo(
    () => groupRunsBySubject(runs, sourcesById, transcriptsById),
    [runs, sourcesById, transcriptsById],
  );
  const sortedGroups = useMemo(
    () => [...groups].toSorted((a, b) => compareGroups(a, b, sort)),
    [groups, sort],
  );

  function handleSort(column: SortColumn) {
    setSort((current) => ({
      column,
      direction: current.column === column && current.direction === 'desc' ? 'asc' : 'desc',
    }));
  }

  const titleLimits = columnLimits?.title;
  const titleHeaderStyle = titleLimits?.maxWidth
    ? { maxWidth: resolveDataTableMaxWidth(titleLimits.maxWidth) }
    : undefined;

  return (
    <div className={showHeading ? styles.withHeading : undefined}>
      {showHeading && (
        <div className={styles.heading}>
          <h2 className={styles.headingTitle}>Runs</h2>
          <span className={styles.headingCount}>{runs.length}</span>
        </div>
      )}
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-0" />
              <SortableHeader column="title" sort={sort} onSort={handleSort} style={titleHeaderStyle}>
                Title
              </SortableHeader>
              <SortableHeader
                column="nodes"
                sort={sort}
                onSort={handleSort}
                className="text-center max-w-[58px]"
              >
                Nodes
              </SortableHeader>
              <SortableHeader column="date" sort={sort} onSort={handleSort}>
                Date
              </SortableHeader>
              <TableHead>Source</TableHead>
              <SortableHeader column="author" sort={sort} onSort={handleSort}>
                Author
              </SortableHeader>
              <SortableHeader column="latency" sort={sort} onSort={handleSort} className="text-right pr-1">
                Latency
              </SortableHeader>
              <TableHead className="text-center pr-3">Delete</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedGroups.length ? (
              sortedGroups.map((group) => (
                <RunsGroupHeader key={group.key} group={group} titleLimits={titleLimits} />
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                  No runs yet. Runs are created when a skill executes.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
