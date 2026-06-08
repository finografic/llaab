import { getSortedRowModel } from '@tanstack/react-table';
import { DataTable, sortableHeader } from 'components/ui/data-table';
import { useMemo } from 'react';
import {
  buildSourcesById,
  renderRunActionsCell,
  renderRunAuthorCell,
  renderRunDateCell,
  renderRunDurationCell,
  renderRunProducedCell,
  renderRunSourceCell,
  renderRunStatusCell,
  renderRunTitleCell,
} from 'tables/RunsTable/RunsTableCells';
import type { RunNode, SourceNode } from '@llaab/schemas';
import type { DataTableColumns } from '@llaab/ui/lib/data-table-utils';

import { useRuns } from 'lib/use-runs';
import { extractRunAuthor, extractRunSourceId } from 'utils/metadata-rendering.utils';

import styles from './RunsTable.module.css';

// ─── Columns ────────────────────────────────────────────────────────────────

export function buildRunsColumns(sourcesById: Map<string, SourceNode>): DataTableColumns<RunNode> {
  return [
    {
      accessorKey: 'title',
      header: sortableHeader('Skill / Title'),
      cell: renderRunTitleCell,
      align: 'left',
    },
    {
      id: 'source',
      accessorFn: (run) => (run.input_summary ? run.input_summary : ''),
      header: 'Source',
      cell: renderRunSourceCell,
      align: 'center',
    },
    {
      id: 'author',
      accessorFn: (run) => {
        const sourceId = extractRunSourceId(run);
        return extractRunAuthor(run) ?? (sourceId ? sourcesById.get(sourceId)?.title : undefined) ?? '';
      },
      header: sortableHeader('Author / Follow'),
      cell: ({ row }) => renderRunAuthorCell(row.original, sourcesById),
      align: 'left',
    },
    {
      accessorKey: 'run_status',
      header: 'Status',
      cell: renderRunStatusCell,
    },
    {
      id: 'produced',
      accessorFn: (run) => run.produced_node_ids.length,
      header: sortableHeader('Nodes'),
      cell: renderRunProducedCell,
      minVisible: 'lg',
    },
    {
      accessorKey: 'duration_ms',
      header: sortableHeader('Duration'),
      cell: renderRunDurationCell,
    },
    {
      accessorKey: 'created_at',
      header: sortableHeader('Date'),
      cell: renderRunDateCell,
      minVisible: 'lg',
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: renderRunActionsCell,
    },
  ];
}

// ─── Component ────────────────────────────────────────────────────────────────

export interface RunsTableProps {
  runs: RunNode[];
  sources?: SourceNode[];
  showHeading?: boolean;
}

export function RunsTable({ runs: initialRuns, sources = [], showHeading = false }: RunsTableProps) {
  const { runs } = useRuns(initialRuns);
  const columns = useMemo(() => buildRunsColumns(buildSourcesById(sources)), [sources]);

  return (
    <div className={showHeading ? styles.withHeading : undefined}>
      {showHeading && (
        <div className={styles.heading}>
          <h2 className={styles.headingTitle}>Runs</h2>
          <span className={styles.headingCount}>{runs.length}</span>
        </div>
      )}
      <DataTable
        columns={columns}
        data={runs}
        emptyMessage="No runs yet. Runs are created when a skill executes."
        options={{ getSortedRowModel: getSortedRowModel() }}
      />
    </div>
  );
}
