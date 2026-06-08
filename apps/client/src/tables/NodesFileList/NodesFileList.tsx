import type { LabNode } from '@llaab/schemas';
import type { ColumnDef } from '@tanstack/react-table';

import { FileCell, FileList } from '../FileList/FileList';
import styles from './NodesFileList.module.css';

// ─── Column definitions ───────────────────────────────────────────────────────

const COLUMNS: Array<ColumnDef<LabNode>> = [
  {
    accessorKey: 'title',
    header: 'Name',
    cell: ({ row }) => (
      <FileCell icon={<NodeTypeIcon type={row.original.type} />} name={row.original.title} />
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    size: 90,
    cell: ({ getValue }) => {
      const v = getValue() as string;
      const cls = `status${v.charAt(0).toUpperCase()}${v.slice(1)}` as keyof typeof s;
      return <span className={`${styles.status} ${styles[cls] ?? ''}`}>{v}</span>;
    },
  },
  {
    accessorKey: 'tags',
    header: 'Tags',
    size: 200,
    enableSorting: false,
    cell: ({ getValue }) => {
      const tags = getValue() as string[];
      if (!tags.length) return null;
      return (
        <span className={styles.tagList}>
          {tags.slice(0, 3).map((t) => (
            <span key={t} className={styles.tag}>
              {t}
            </span>
          ))}
        </span>
      );
    },
  },
  {
    accessorKey: 'created_at',
    header: 'Date',
    size: 120,
    cell: ({ getValue }) =>
      new Date(getValue() as string).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }),
  },
];

// ─── Type order + group rendering ────────────────────────────────────────────

const TYPE_ORDER = ['idea', 'resource', 'prompt', 'skill', 'instruction'] as const;

export interface NodesFileListProps {
  nodes: LabNode[];
}

export function NodesFileList({ nodes }: NodesFileListProps) {
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
                window.location.href = `/vault/nodes/${row.id}`;
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
  const cls = `icon${type.charAt(0).toUpperCase()}${type.slice(1)}` as keyof typeof s;
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
