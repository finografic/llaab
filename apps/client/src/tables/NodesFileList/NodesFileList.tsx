import { TagList } from 'components/TagList/TagList';
import { useNavigate } from 'react-router-dom';
import type { LabNode } from '@llaab/schemas';
import type { CellContext, ColumnDef } from '@tanstack/react-table';

import { formatListDateNumeric } from 'utils/format-date.utils';

import { FileCell, FileList } from '../FileList/FileList';
import styles from './NodesFileList.module.css';

// ─── Column cell renderers (module scope) ─────────────────────────────────────

function renderNameCell({ row }: CellContext<LabNode, unknown>) {
  return <FileCell icon={<NodeTypeIcon type={row.original.type} />} name={row.original.title} />;
}

function renderStatusCell({ getValue }: CellContext<LabNode, unknown>) {
  const v = getValue() as string;
  const cls = `status${v.charAt(0).toUpperCase()}${v.slice(1)}` as keyof typeof styles;
  return <span className={`${styles.status} ${styles[cls] ?? ''}`}>{v}</span>;
}

function renderTagsCell({ getValue }: CellContext<LabNode, unknown>) {
  const tags = getValue() as string[];
  if (!tags.length) return null;
  return <TagList tags={tags.slice(0, 3)} size="sm" className={styles.tagList} />;
}

function renderDateCell({ getValue }: CellContext<LabNode, unknown>) {
  const createdAt = getValue() as string;
  return (
    <time className={styles.date} dateTime={createdAt}>
      {formatListDateNumeric(createdAt)}
    </time>
  );
}

// ─── Column definitions ───────────────────────────────────────────────────────

const COLUMNS: Array<ColumnDef<LabNode>> = [
  {
    accessorKey: 'title',
    header: 'Name',
    // size 150 (TanStack default) → FileList treats as flex-fill
    cell: renderNameCell,
  },
  {
    accessorKey: 'tags',
    header: 'Tags',
    // Share remaining width with Name; keeps Status/Date clustered on the right.
    size: 150,
    enableSorting: false,
    cell: renderTagsCell,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    size: 100,
    cell: renderStatusCell,
  },
  {
    accessorKey: 'created_at',
    header: 'Date',
    size: 110,
    cell: renderDateCell,
  },
];

// ─── Type order + group rendering ────────────────────────────────────────────

const TYPE_ORDER = ['idea', 'resource', 'prompt', 'skill', 'instruction'] as const;

export interface NodesFileListProps {
  nodes: LabNode[];
}

export function NodesFileList({ nodes }: NodesFileListProps) {
  const navigate = useNavigate();
  const byType = Object.groupBy(nodes, (n) => n.type);

  return (
    <div className={styles.root}>
      {TYPE_ORDER.map((type) => {
        const group = byType[type];
        if (!group?.length) return null;

        return (
          <section key={type} className={styles.group}>
            <div className={styles.groupHeader}>
              <span className={styles.groupType}>{type}</span>
              <span className={styles.groupCount}>{group.length}</span>
            </div>
            <FileList
              data={group}
              columns={COLUMNS}
              getRowId={(row) => row.id}
              onRowClick={(row) => {
                void navigate(`/vault/nodes/${row.id}`);
              }}
              label={`${type} nodes`}
            />
          </section>
        );
      })}
    </div>
  );
}

// ─── Node type icon ───────────────────────────────────────────────────────────

function NodeTypeIcon({ type }: { type: string }) {
  const cls = `icon${type.charAt(0).toUpperCase()}${type.slice(1)}` as keyof typeof styles;
  return (
    <span className={styles[cls]}>
      {type === 'idea' && <IconIdea />}
      {type === 'resource' && <IconResource />}
      {type === 'prompt' && <IconPrompt />}
      {type === 'skill' && <IconSkill />}
      {type === 'instruction' && <IconInstruction />}
    </span>
  );
}

function IconIdea() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 18h6M10 22h4M12 2a7 7 0 0 1 4 12.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26A7 7 0 0 1 12 2z" />
    </svg>
  );
}

function IconResource() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function IconPrompt() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="4 7 4 4 20 4 20 7" />
      <line x1="9" y1="20" x2="15" y2="20" />
      <line x1="12" y1="4" x2="12" y2="20" />
    </svg>
  );
}

function IconSkill() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  );
}

function IconInstruction() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  );
}
