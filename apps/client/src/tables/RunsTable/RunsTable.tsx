import { Button } from 'components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from 'components/ui/table';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useRuns } from 'queries/runs';
import { useMemo, useState } from 'react';
import { RunsGroupHeader } from 'tables/RunsTable/RunsGroupHeader';
import { buildSourcesById } from 'tables/RunsTable/RunsTable.utils';
import type { SourceNode, TranscriptNode } from '@llaab/schemas';
import type { ReactNode } from 'react';

import { isIngestRun, isRunExtracting } from 'utils/run-display.utils';
import type { RunGroup } from 'utils/run-grouping.utils';
import { groupRunsBySubject } from 'utils/run-grouping.utils';

import styles from './RunsTable.module.css';

// ─── Component ────────────────────────────────────────────────────────────────

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
}

function SortableHeader({
  column,
  sort,
  onSort,
  className,
  children,
}: {
  column: SortColumn;
  sort: SortState;
  onSort: (column: SortColumn) => void;
  className?: string;
  children: ReactNode;
}) {
  const isActive = sort.column === column;
  const Icon = isActive ? (sort.direction === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;

  return (
    <TableHead className={className}>
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

export function RunsTable({ sources = [], transcripts = [], showHeading = false }: RunsTableProps) {
  const [sort, setSort] = useState<SortState>({ column: 'date', direction: 'desc' });
  const { data: allRuns = [] } = useRuns({
    refetchInterval: (query) => {
      const data = query.state.data ?? [];
      return data.some(isRunExtracting) ? 1000 : false;
    },
  });
  const runs = useMemo(() => allRuns.filter(isIngestRun), [allRuns]);
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
              <SortableHeader column="title" sort={sort} onSort={handleSort}>
                Title
              </SortableHeader>
              <SortableHeader column="date" sort={sort} onSort={handleSort}>
                Date
              </SortableHeader>
              <TableHead>Source</TableHead>
              <SortableHeader column="author" sort={sort} onSort={handleSort}>
                Author
              </SortableHeader>
              <SortableHeader
                column="nodes"
                sort={sort}
                onSort={handleSort}
                className="text-center max-w-[58px]"
              >
                Nodes
              </SortableHeader>
              <SortableHeader column="latency" sort={sort} onSort={handleSort} className="text-right pr-1">
                Latency
              </SortableHeader>
              <TableHead className="text-center pr-3">Delete</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedGroups.length ? (
              sortedGroups.map((group) => <RunsGroupHeader key={group.key} group={group} />)
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
