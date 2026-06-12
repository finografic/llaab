import { getSortedRowModel } from '@tanstack/react-table';
import { DataTable, sortableHeader } from 'components/ui/data-table';
import type { SourceNode } from '@llaab/schemas';
import type { DataTableColumns } from '@llaab/ui/lib/data-table-utils';
import type { CellContext } from '@tanstack/react-table';

import { isYouTubeChannelSource } from 'utils/youtube-source.utils';

import styles from './SourcesTable.module.css';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const KIND_CLASS: Record<SourceNode['source_kind'], string> = {
  person: styles.kindPerson,
  channel: styles.kindChannel,
  repo: styles.kindRepo,
  publication: styles.kindPublication,
  organization: styles.kindOrganization,
  other: styles.kindOther,
};

function renderSourceTitleCell({ row }: CellContext<SourceNode, unknown>) {
  return (
    <div className={styles.titleCell}>
      <a href={`/vault/sources/${row.original.id}`} className={styles.titleLink}>
        {row.original.title}
      </a>
      {row.original.body && <span className={styles.summary}>{row.original.body}</span>}
    </div>
  );
}

function renderSourceKindCell({ getValue }: CellContext<SourceNode, unknown>) {
  const kind = getValue<SourceNode['source_kind']>();
  return <span className={`${styles.kind} ${KIND_CLASS[kind]}`}>{kind}</span>;
}

function renderSourceFollowingCell({ row }: CellContext<SourceNode, unknown>) {
  const source = row.original;
  if (!isYouTubeChannelSource(source)) {
    return <span className={styles.muted}>—</span>;
  }

  if (source.youtube_subscribed === true) {
    return <span className={`${styles.kind} ${styles.follow}`}>true</span>;
  }

  if (source.youtube_subscribed === false) {
    return <span className={styles.muted}>false</span>;
  }

  return <span className={styles.muted}>—</span>;
}

function renderSourcePlatformsCell({ row }: CellContext<SourceNode, unknown>) {
  return row.original.platforms.length > 0 ? (
    <span className={styles.mono}>{row.original.platforms.join(', ')}</span>
  ) : (
    <span className={styles.muted}>—</span>
  );
}

function renderSourceDateCell({ getValue }: CellContext<SourceNode, unknown>) {
  const createdAt = getValue<string>();
  return (
    <time className={styles.mono} dateTime={createdAt}>
      {fmtDate(createdAt)}
    </time>
  );
}

const SOURCES_COLUMNS: DataTableColumns<SourceNode> = [
  {
    accessorKey: 'title',
    header: sortableHeader('Title'),
    cell: renderSourceTitleCell,
  },
  {
    accessorKey: 'source_kind',
    header: sortableHeader('Kind'),
    cell: renderSourceKindCell,
  },
  {
    id: 'following',
    header: 'Following',
    cell: renderSourceFollowingCell,
  },
  {
    id: 'platforms',
    accessorFn: (source) => source.platforms.join(', '),
    header: 'Platforms',
    cell: renderSourcePlatformsCell,
  },
  {
    accessorKey: 'created_at',
    header: sortableHeader('Date'),
    cell: renderSourceDateCell,
  },
];

export interface SourcesTableProps {
  sources: SourceNode[];
}

export function SourcesTable({ sources }: SourcesTableProps) {
  return (
    <DataTable
      columns={SOURCES_COLUMNS}
      data={sources}
      emptyMessage="No sources yet. Sources are created automatically when ingesting content."
      options={{ getSortedRowModel: getSortedRowModel() }}
    />
  );
}
