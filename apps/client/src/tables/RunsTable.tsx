import { getSortedRowModel } from '@tanstack/react-table';
import { DeleteRunAction } from 'components/DeleteRunAction/DeleteRunAction';
import { MetadataLink } from 'components/MetadataLink/MetadataLink';
import { DataTable, sortableHeader } from 'components/ui/data-table';
import type { RunNode } from '@llaab/schemas';
import type { DataTableColumns } from '@llaab/ui/lib/data-table-utils';
import type { CellContext } from '@tanstack/react-table';

import { useRuns } from 'lib/use-runs';
import { extractMetadataUrl } from 'utils/metadata-rendering.utils';

import s from './RunsTable.module.css';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(ms?: number): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_CLASS: Record<RunNode['run_status'], string> = {
  pending: s.statusPending,
  running: s.statusRunning,
  completed: s.statusCompleted,
  failed: s.statusFailed,
  cancelled: s.statusCancelled,
};

function renderRunTitleCell({ row }: CellContext<RunNode, unknown>) {
  const inputUrl = row.original.input_summary ? extractMetadataUrl(row.original.input_summary) : undefined;

  return (
    <div className={s.title}>
      <a href={`/vault/runs/${row.original.id}`} className={s.titleLink}>
        {row.original.title}
      </a>
      {inputUrl && (
        <MetadataLink href={inputUrl} className={s.inputUrl}>
          {inputUrl}
        </MetadataLink>
      )}
    </div>
  );
}

function renderRunStatusCell({ getValue }: CellContext<RunNode, unknown>) {
  const status = getValue<RunNode['run_status']>();
  return <span className={`${s.status} ${STATUS_CLASS[status]}`}>{status}</span>;
}

function renderRunProducedCell({ getValue }: CellContext<RunNode, unknown>) {
  return <span className={s.mono}>{getValue<number>()}</span>;
}

function renderRunDurationCell({ getValue }: CellContext<RunNode, unknown>) {
  return <span className={s.mono}>{fmtDuration(getValue<number | undefined>())}</span>;
}

function renderRunDateCell({ getValue }: CellContext<RunNode, unknown>) {
  const createdAt = getValue<string>();
  return (
    <time className={s.mono} dateTime={createdAt}>
      {fmtDate(createdAt)}
    </time>
  );
}

function renderRunActionsCell({ row }: CellContext<RunNode, unknown>) {
  return <DeleteRunAction run={row.original} />;
}

const RUNS_COLUMNS: DataTableColumns<RunNode> = [
  {
    accessorKey: 'title',
    header: sortableHeader('Skill / Title'),
    cell: renderRunTitleCell,
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
  },
  {
    id: 'actions',
    header: 'Actions',
    cell: renderRunActionsCell,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export interface RunsTableProps {
  runs: RunNode[];
  showHeading?: boolean;
}

export function RunsTable({ runs: initialRuns, showHeading = false }: RunsTableProps) {
  const { runs } = useRuns(initialRuns);

  return (
    <div className={showHeading ? s.withHeading : undefined}>
      {showHeading && (
        <div className={s.heading}>
          <h2 className={s.headingTitle}>Runs</h2>
          <span className={s.headingCount}>{runs.length}</span>
        </div>
      )}
      <DataTable
        columns={RUNS_COLUMNS}
        data={runs}
        emptyMessage="No runs yet. Runs are created when a skill executes."
        options={{ getSortedRowModel: getSortedRowModel() }}
      />
    </div>
  );
}
