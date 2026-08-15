import { resolveDataTableMaxWidth } from '@llaab/ui/lib/data-table-utils';
import { ListPagination, useListPagination } from 'components/ListPagination';
import { Button } from 'components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from 'components/ui/table';
import { ToggleGroup, ToggleGroupItem } from 'components/ui/toggle-group';
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
type DateMode = 'ingested' | 'published';

const DATE_MODE_OPTIONS: Array<{ label: string; value: DateMode }> = [
  { label: 'ingested', value: 'ingested' },
  { label: 'published', value: 'published' },
];

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

function groupDateValue(group: RunGroup, dateMode: DateMode): string | undefined {
  return dateMode === 'published' ? group.publishedAt : group.latestDate;
}

function compareOptionalDates(
  a: string | undefined,
  b: string | undefined,
  direction: SortDirection,
): number {
  if (a && !b) return -1;
  if (!a && b) return 1;
  if (!a && !b) return 0;
  if (!a || !b) return 0;
  return compareStrings(a, b, direction);
}

function compareGroups(a: RunGroup, b: RunGroup, sort: SortState, dateMode: DateMode): number {
  switch (sort.column) {
    case 'title':
      return compareStrings(a.title, b.title, sort.direction);
    case 'date':
      return compareOptionalDates(groupDateValue(a, dateMode), groupDateValue(b, dateMode), sort.direction);
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
  const [dateMode, setDateMode] = useState<DateMode>('ingested');
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
    () => [...groups].toSorted((a, b) => compareGroups(a, b, sort, dateMode)),
    [dateMode, groups, sort],
  );
  const paginationResetKey = `${sort.column}:${sort.direction}:${dateMode}:${skillIds?.join(',') ?? 'all'}`;
  const {
    page,
    pageCount,
    pageItems: pagedGroups,
    pageSize,
    setPage,
    setPageSize,
  } = useListPagination({
    items: sortedGroups,
    storageKey: showHeading ? 'runs.ingest.pageSize' : 'runs.pageSize',
    resetKey: paginationResetKey,
  });

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
          <div className={styles.headingLabel}>
            <h2 className={styles.headingTitle}>Runs</h2>
            <span className={styles.headingCount}>{runs.length}</span>
          </div>
          <div className={styles.headingControls}>
            <span className={styles.dateModeLabel}>date:</span>
            <ToggleGroup
              type="single"
              variant="outline"
              size="sm"
              spacing={0}
              value={dateMode}
              onValueChange={(value) => {
                if (value === 'ingested' || value === 'published') setDateMode(value);
              }}
              aria-label="Date column mode"
            >
              {DATE_MODE_OPTIONS.map((option) => (
                <ToggleGroupItem
                  key={option.value}
                  value={option.value}
                  className={styles.dateModeOption}
                  aria-label={`Use ${option.label} date`}
                >
                  {option.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </div>
      )}
      <div className="overflow-x-auto rounded-md border">
        <Table className={styles.runsTable}>
          <colgroup>
            <col className={styles.toggleColumn} />
            <col className={styles.titleColumn} />
            <col className={styles.nodesColumn} />
            <col className={styles.dateColumn} />
            <col className={styles.sourceColumn} />
            <col className={styles.authorColumn} />
            <col className={styles.latencyColumn} />
            <col className={styles.deleteColumn} />
          </colgroup>
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
              <TableHead className={styles.sourceColumn}>Source</TableHead>
              <SortableHeader column="author" sort={sort} onSort={handleSort} className={styles.authorColumn}>
                Author
              </SortableHeader>
              <SortableHeader column="latency" sort={sort} onSort={handleSort} className="text-right pr-1">
                Latency
              </SortableHeader>
              <TableHead className="text-center pr-3">Delete</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pagedGroups.length ? (
              pagedGroups.map((group) => (
                <RunsGroupHeader
                  key={group.key}
                  group={group}
                  titleLimits={titleLimits}
                  dateMode={dateMode}
                />
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
      <ListPagination
        page={page}
        pageCount={pageCount}
        pageSize={pageSize}
        totalItems={sortedGroups.length}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}
