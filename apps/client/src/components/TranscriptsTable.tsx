import { getSortedRowModel } from '@tanstack/react-table';
import { DataTable, sortableHeader } from 'components/ui/data-table';
import type { TranscriptNode } from '@llaab/schemas';
import type { DataTableColumns } from '@llaab/ui/lib/data-table-utils';
import type { CellContext } from '@tanstack/react-table';

import s from './TranscriptsTable.module.css';

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const SOURCE_TYPE_CLASS: Record<TranscriptNode['source_type'], string> = {
  youtube: s.typeYoutube,
  article: s.typeArticle,
  repo: s.typeRepo,
  chat: s.typeChat,
  other: s.typeOther,
};

function renderTranscriptTitleCell({ row }: CellContext<TranscriptNode, unknown>) {
  return (
    <div className={s.titleCell}>
      <a href={`/vault/transcripts/${row.original.id}`} className={s.titleLink}>
        {row.original.title}
      </a>
      {row.original.summary && <span className={s.summary}>{row.original.summary}</span>}
    </div>
  );
}

function renderTranscriptSourceTypeCell({ getValue }: CellContext<TranscriptNode, unknown>) {
  const sourceType = getValue<TranscriptNode['source_type']>();
  return <span className={`${s.type} ${SOURCE_TYPE_CLASS[sourceType]}`}>{sourceType}</span>;
}

function renderTranscriptAuthorCell({ getValue }: CellContext<TranscriptNode, unknown>) {
  const author = getValue<string | undefined>();
  return author ? <span className={s.author}>{author}</span> : <span className={s.muted}>—</span>;
}

function renderTranscriptIdeasCell({ getValue }: CellContext<TranscriptNode, unknown>) {
  const count = getValue<number>();
  return count > 0 ? <span className={s.ideas}>{count}</span> : <span className={s.muted}>—</span>;
}

function renderTranscriptDateCell({ getValue }: CellContext<TranscriptNode, unknown>) {
  const createdAt = getValue<string>();
  return (
    <time className={s.mono} dateTime={createdAt}>
      {fmtDate(createdAt)}
    </time>
  );
}

const TRANSCRIPTS_COLUMNS: DataTableColumns<TranscriptNode> = [
  {
    accessorKey: 'title',
    header: sortableHeader('Title'),
    cell: renderTranscriptTitleCell,
  },
  {
    accessorKey: 'source_type',
    header: sortableHeader('Source'),
    cell: renderTranscriptSourceTypeCell,
  },
  {
    accessorKey: 'author',
    header: sortableHeader('Author'),
    cell: renderTranscriptAuthorCell,
  },
  {
    id: 'ideas',
    accessorFn: (transcript) => transcript.extracted_idea_ids.length,
    header: sortableHeader('Ideas'),
    cell: renderTranscriptIdeasCell,
  },
  {
    accessorKey: 'created_at',
    header: sortableHeader('Date'),
    cell: renderTranscriptDateCell,
  },
];

export interface TranscriptsTableProps {
  transcripts: TranscriptNode[];
}

export function TranscriptsTable({ transcripts }: TranscriptsTableProps) {
  return (
    <DataTable
      columns={TRANSCRIPTS_COLUMNS}
      data={transcripts}
      emptyMessage="No transcripts yet. Ingest a YouTube video to get started."
      options={{ getSortedRowModel: getSortedRowModel() }}
    />
  );
}
