import { getSortedRowModel } from '@tanstack/react-table';
import type { RunNode } from '@llaab/schemas';
import type { DataTableColumns } from '@llaab/ui/lib/data-table-utils';
import { DeleteRunAction } from 'components/DeleteRunAction/DeleteRunAction';
import { MetadataLink } from 'components/MetadataLink/MetadataLink';
import { DataTable, sortableHeader } from 'components/ui/data-table';
import { useCallback, useMemo, useState } from 'react';
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

// ─── Component ────────────────────────────────────────────────────────────────

export interface RunsTableProps {
  runs: RunNode[];
}

export function RunsTable({ runs: initialRuns }: RunsTableProps) {
  const [runs, setRuns] = useState(initialRuns);

  const handleDeleted = useCallback((runId: string) => {
    setRuns((current) => current.filter((run) => run.id !== runId));
  }, []);

  const columns = useMemo<DataTableColumns<RunNode>>(
    () => [
      {
        accessorKey: 'title',
        header: sortableHeader('Skill / Title'),
        cell: ({ row }) => {
          const inputUrl = row.original.input_summary
            ? extractMetadataUrl(row.original.input_summary)
            : undefined;

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
        },
      },
      {
        accessorKey: 'run_status',
        header: 'Status',
        cell: ({ getValue }) => {
          const status = getValue<RunNode['run_status']>();
          return <span className={`${s.status} ${STATUS_CLASS[status]}`}>{status}</span>;
        },
      },
      {
        id: 'produced',
        accessorFn: (run) => run.produced_node_ids.length,
        header: sortableHeader('Nodes produced'),
        cell: ({ getValue }) => <span className={s.mono}>{getValue<number>()}</span>,
      },
      {
        accessorKey: 'duration_ms',
        header: sortableHeader('Duration'),
        cell: ({ getValue }) => <span className={s.mono}>{fmtDuration(getValue<number | undefined>())}</span>,
      },
      {
        accessorKey: 'created_at',
        header: sortableHeader('Date'),
        cell: ({ getValue }) => (
          <time className={s.mono} dateTime={getValue<string>()}>
            {fmtDate(getValue<string>())}
          </time>
        ),
      },
      {
        id: 'actions',
        header: 'Actions',
        cell: ({ row }) => <DeleteRunAction run={row.original} onDeleted={handleDeleted} />,
      },
    ],
    [handleDeleted],
  );

  return (
    <DataTable
      columns={columns}
      data={runs}
      emptyMessage="No runs yet. Runs are created when a skill executes."
      options={{ getSortedRowModel: getSortedRowModel() }}
    />
  );
}
