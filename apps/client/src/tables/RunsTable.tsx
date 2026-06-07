import { getSortedRowModel } from '@tanstack/react-table';
import { DeleteRunAction } from 'components/DeleteRunAction/DeleteRunAction';
import { MetadataLink } from 'components/MetadataLink/MetadataLink';
import { DataTable, sortableHeader } from 'components/ui/data-table';
import { useMemo } from 'react';
import type { RunNode, SourceNode } from '@llaab/schemas';
import type { DataTableColumns } from '@llaab/ui/lib/data-table-utils';
import type { CellContext } from '@tanstack/react-table';

import { useRuns } from 'lib/use-runs';
import {
  extractMetadataUrl,
  extractRunAuthor,
  extractRunSourceId,
  extractRunSubjectHref,
  extractRunSubjectTitle,
} from 'utils/metadata-rendering.utils';

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
  const run = row.original;
  const inputUrl = run.input_summary ? extractMetadataUrl(run.input_summary) : undefined;
  const subjectTitle = extractRunSubjectTitle(run);
  const subjectHref = extractRunSubjectHref(run) ?? inputUrl;

  return (
    <div className={s.title}>
      {subjectTitle && subjectHref && (
        <a href={subjectHref} className={s.subjectTitle}>
          {subjectTitle}
        </a>
      )}
      {subjectTitle && !subjectHref && <span className={s.subjectTitle}>{subjectTitle}</span>}
      <a href={`/vault/runs/${run.id}`} className={s.runLabel}>
        {run.title}
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

function buildSourcesById(sources: SourceNode[]): Map<string, SourceNode> {
  return new Map(sources.map((source) => [source.id, source]));
}

function renderRunAuthorCell(run: RunNode, sourcesById: Map<string, SourceNode>) {
  const sourceId = extractRunSourceId(run);
  const source = sourceId ? sourcesById.get(sourceId) : undefined;
  const author = extractRunAuthor(run) ?? source?.title;
  const follow = source?.follow;

  if (!author && follow !== true) {
    return <span className={s.muted}>—</span>;
  }

  return (
    <div className={s.authorCell}>
      {author &&
        (sourceId ? (
          <a href={`/vault/sources/${sourceId}`} className={s.authorLink}>
            {author}
          </a>
        ) : (
          <span className={s.authorName}>{author}</span>
        ))}
      {follow === true ? (
        <span className={`${s.badge} ${s.follow}`}>following</span>
      ) : (
        <span className={s.muted}>—</span>
      )}
    </div>
  );
}

function buildRunsColumns(sourcesById: Map<string, SourceNode>): DataTableColumns<RunNode> {
  return [
    {
      accessorKey: 'title',
      header: sortableHeader('Skill / Title'),
      cell: renderRunTitleCell,
      align: 'left',
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
    <div className={showHeading ? s.withHeading : undefined}>
      {showHeading && (
        <div className={s.heading}>
          <h2 className={s.headingTitle}>Runs</h2>
          <span className={s.headingCount}>{runs.length}</span>
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
