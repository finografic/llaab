import { getSortedRowModel } from '@tanstack/react-table';
import { DataTable, sortableHeader } from 'components/ui/data-table';
import { ExternalLinkIcon } from 'lucide-react';
import type { TranscriptSourceType } from '@llaab/schemas';
import type { DataTableColumns } from '@llaab/ui/lib/data-table-utils';
import type { CellContext } from '@tanstack/react-table';

import styles from './SourceTranscriptsTable.module.css';

export interface SourceTranscriptsTableRow {
  id: string;
  title: string;
  sourceType: TranscriptSourceType;
  sourceUrl: string;
  publishedAt?: string;
  transcriptCreatedAt: string;
  ideaCount: number;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const SOURCE_TYPE_CLASS: Record<TranscriptSourceType, string> = {
  youtube: styles.typeYoutube,
  article: styles.typeArticle,
  repo: styles.typeRepo,
  chat: styles.typeChat,
  other: styles.typeOther,
};

function renderTitleCell({ row }: CellContext<SourceTranscriptsTableRow, unknown>) {
  return (
    <a href={`/vault/transcripts/${row.original.id}`} className={styles.titleLink}>
      {row.original.title}
    </a>
  );
}

function renderPlatformCell({ getValue }: CellContext<SourceTranscriptsTableRow, unknown>) {
  const sourceType = getValue<TranscriptSourceType>();
  return <span className={`${styles.type} ${SOURCE_TYPE_CLASS[sourceType]}`}>{sourceType}</span>;
}

function renderSourceCell({ row }: CellContext<SourceTranscriptsTableRow, unknown>) {
  return (
    <a
      href={row.original.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.sourceLink}
      aria-label={row.original.sourceUrl}
    >
      <ExternalLinkIcon size={18} aria-hidden />
    </a>
  );
}

function renderPublishedCell({ getValue }: CellContext<SourceTranscriptsTableRow, unknown>) {
  const publishedAt = getValue<string | undefined>();
  return publishedAt ? (
    <time className={styles.mono} dateTime={publishedAt}>
      {fmtDate(publishedAt)}
    </time>
  ) : (
    <span className={styles.muted}>—</span>
  );
}

function renderTranscriptCreatedCell({ getValue }: CellContext<SourceTranscriptsTableRow, unknown>) {
  const createdAt = getValue<string>();
  return (
    <time className={styles.mono} dateTime={createdAt}>
      {fmtDate(createdAt)}
    </time>
  );
}

function renderIdeasCell({ getValue }: CellContext<SourceTranscriptsTableRow, unknown>) {
  const count = getValue<number>();
  return count > 0 ? <span className={styles.ideas}>{count}</span> : <span className={styles.muted}>—</span>;
}

const SOURCE_TRANSCRIPTS_COLUMNS: DataTableColumns<SourceTranscriptsTableRow> = [
  {
    accessorKey: 'title',
    header: sortableHeader('Title'),
    cell: renderTitleCell,
    align: 'left',
  },
  {
    accessorKey: 'sourceType',
    header: sortableHeader('Platform'),
    cell: renderPlatformCell,
  },
  {
    id: 'source',
    accessorFn: (transcript) => transcript.sourceUrl,
    header: sortableHeader('Source'),
    cell: renderSourceCell,
  },
  {
    accessorKey: 'publishedAt',
    header: sortableHeader('Published'),
    cell: renderPublishedCell,
  },
  {
    accessorKey: 'transcriptCreatedAt',
    header: sortableHeader('Ingested'),
    cell: renderTranscriptCreatedCell,
  },
  {
    accessorKey: 'ideaCount',
    header: sortableHeader('Ideas'),
    cell: renderIdeasCell,
  },
];

export interface SourceTranscriptsTableProps {
  transcripts: SourceTranscriptsTableRow[];
}

export function SourceTranscriptsTable({ transcripts }: SourceTranscriptsTableProps) {
  return (
    <DataTable
      columns={SOURCE_TRANSCRIPTS_COLUMNS}
      data={transcripts}
      emptyMessage="No transcripts for this source yet."
      options={{ getSortedRowModel: getSortedRowModel() }}
    />
  );
}
