import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from 'components/ui/table';
import { useRuns } from 'queries/runs';
import { useMemo } from 'react';
import { RunGroupRow } from 'tables/RunsTable/RunGroupRow';
import { buildSourcesById } from 'tables/RunsTable/RunsTableCells';
import type { SourceNode } from '@llaab/schemas';

import { groupRunsBySubject } from 'utils/run-grouping.utils';

import styles from './RunsTable.module.css';

// ─── Component ────────────────────────────────────────────────────────────────

export interface RunsTableProps {
  sources?: SourceNode[];
  showHeading?: boolean;
}

export function RunsTable({ sources = [], showHeading = false }: RunsTableProps) {
  const { data: runs = [] } = useRuns();
  const sourcesById = useMemo(() => buildSourcesById(sources), [sources]);
  const groups = useMemo(() => groupRunsBySubject(runs, sourcesById), [runs, sourcesById]);

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
              <TableHead>Title</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Author</TableHead>
              <TableHead className="text-center">Nodes</TableHead>
              <TableHead className="text-center">Duration</TableHead>
              <TableHead className="text-center">Date</TableHead>
              <TableHead className="text-center">Delete</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.length ? (
              groups.map((group) => <RunGroupRow key={group.key} group={group} />)
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
