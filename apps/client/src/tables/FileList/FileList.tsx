import { flexRender, getCoreRowModel, getSortedRowModel, useReactTable } from '@tanstack/react-table';
import { useState } from 'react';
import type { ColumnDef, SortingState } from '@tanstack/react-table';

import styles from './FileList.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface FileListProps<TData> {
  data: TData[];
  columns: Array<ColumnDef<TData>>;
  /** Called when a row is clicked or activated via keyboard. */
  onRowClick?: (row: TData) => void;
  /** Row ID of the currently selected row — drives [data-selected]. */
  selectedId?: string;
  /** Derive a stable string ID from a row. Falls back to row index. */
  getRowId?: (row: TData, index: number) => string;
  /** Message shown when data is empty. */
  emptyMessage?: string;
  /** Show loading skeleton rows instead of data. */
  loading?: boolean;
  /** Aria label for the list region. */
  label?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function FileList<TData>({
  data,
  columns,
  onRowClick,
  selectedId,
  getRowId,
  emptyMessage = 'No items.',
  loading = false,
  label = 'File list',
}: FileListProps<TData>) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId,
  });

  return (
    <div className={styles.root} role="grid" aria-label={label} aria-rowcount={data.length}>
      {/* ── Column headers ──────────────────────────────────────── */}
      <div className={styles.headerRow} role="row">
        {table.getHeaderGroups().map((group) =>
          group.headers.map((header) => {
            const canSort = header.column.getCanSort();
            const sorted = header.column.getIsSorted();

            return (
              <div
                key={header.id}
                className={styles.headerCell}
                style={columnFlex(header.column.getSize())}
                onClick={canSort ? header.column.getToggleSortingHandler() : undefined}
                data-sortable={canSort || undefined}
                data-sort={sorted || undefined}
                role="columnheader"
                aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'}
              >
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
                {canSort && (
                  <span className={styles.sortIcon} aria-hidden="true">
                    {sorted === 'asc' ? '↑' : sorted === 'desc' ? '↓' : '↕'}
                  </span>
                )}
              </div>
            );
          }),
        )}
      </div>

      {/* ── Body ────────────────────────────────────────────────── */}
      <div className={styles.body} role="rowgroup">
        {loading ? (
          <SkeletonRows count={8} />
        ) : table.getRowModel().rows.length === 0 ? (
          <div className={styles.emptyState} role="row">
            <span className={styles.emptyText}>{emptyMessage}</span>
          </div>
        ) : (
          table.getRowModel().rows.map((row) => {
            const isSelected = selectedId != null && row.id === selectedId;

            return (
              <div
                key={row.id}
                className={styles.row}
                data-selected={isSelected || undefined}
                data-clickable={onRowClick ? true : undefined}
                onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                role="row"
                aria-selected={isSelected}
                tabIndex={0}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && onRowClick) {
                    e.preventDefault();
                    onRowClick(row.original);
                  }
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <div
                    key={cell.id}
                    className={styles.cell}
                    style={columnFlex(cell.column.getSize())}
                    role="gridcell"
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── FileCell — name cell with optional icon ──────────────────────────────────

/**
 * Pre-composed cell for the primary "name" column. Shows a file-type icon on the left and the name on the
 * right.
 *
 * Usage in a column def: cell: ({ row }) => <FileCell icon={<TranscriptIcon />} name={row.original.title} />
 */
export function FileCell({ icon, name, meta }: { icon?: React.ReactNode; name: string; meta?: string }) {
  return (
    <div className={styles.fileCell}>
      {icon && (
        <span className={styles.fileCellIcon} aria-hidden="true">
          {icon}
        </span>
      )}
      <span className={styles.fileCellName}>{name}</span>
      {meta && <span className={styles.fileCellMeta}>{meta}</span>}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** TanStack default column size is 150 — treat that sentinel as "fill remaining space". */
function columnFlex(size: number): React.CSSProperties {
  return size === 150 ? { flex: '1', minWidth: 0 } : { flex: `0 0 ${size}px` };
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`${styles.row} ${styles.rowSkeleton}`} role="row" aria-hidden="true">
          <div className={styles.skeletonBar} style={{ width: '40%' }} />
          <div className={styles.skeletonBar} style={{ width: '20%' }} />
          <div className={styles.skeletonBar} style={{ width: '15%' }} />
        </div>
      ))}
    </>
  );
}
