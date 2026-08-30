import { flexRender, getCoreRowModel, getPaginationRowModel, useReactTable } from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DataTableColumnAlign, DataTableColumnDef } from '../lib/data-table-utils';
import type { Column, ColumnDef, Cell, TableOptions } from '@tanstack/react-table';
import type { CSSProperties, ReactNode } from 'react';

import { minVisibleTableCellClass, resolveDataTableMaxWidth, truncateChars } from '../lib/data-table-utils';
import { cn } from '../lib/utils';
import { Button } from './button';
import { Pagination, PaginationContent, PaginationItem } from './pagination';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Props for {@link DataTable}. Generic over the row shape `TData` so the same
 * component can render any tabular data — pass a typed `columns` array and the
 * matching `data` array.
 */
export interface DataTableProps<TData, TValue = unknown> {
  columns: Array<DataTableColumnDef<TData, TValue>>;
  data: TData[];
  /** Message shown in place of rows when `data` is empty. */
  emptyMessage?: string;
  /** Extra `useReactTable` options (sorting, filtering, pagination row models, etc.). */
  options?: Partial<TableOptions<TData>>;
}

const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;

function paginationItems(page: number, pageCount: number): Array<number | 'ellipsis'> {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, index) => index + 1);

  const items: Array<number | 'ellipsis'> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);

  if (start > 2) items.push('ellipsis');
  for (let value = start; value <= end; value += 1) items.push(value);
  if (end < pageCount - 1) items.push('ellipsis');
  items.push(pageCount);

  return items;
}

// ─── Column header factories ──────────────────────────────────────────────────

/**
 * Renders a column header as a button that toggles ascending/descending sort —
 * the shadcn data-table convention for sortable columns. Requires `getSortedRowModel`
 * to be enabled (pass it via the `options` prop).
 *
 * @example
 *   { accessorKey: 'email', header: sortableHeader('Email') }
 */
export function sortableHeader<TData>(label: string) {
  return ({ column }: { column: Column<TData> }) => {
    const isSorted = column.getIsSorted() !== false;

    return (
      <Button
        variant="ghost"
        className={cn(isSorted ? 'text-foreground' : 'text-muted-foreground opacity-70')}
        onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
      >
        {label}
        <ArrowUpDown />
      </Button>
    );
  };
}

function resolveColumnId<TData, TValue>(column: DataTableColumnDef<TData, TValue>): string | undefined {
  if (column.id) return column.id;

  const accessorKey = 'accessorKey' in column ? column.accessorKey : undefined;
  if (typeof accessorKey === 'string') return accessorKey;

  return undefined;
}

const ALIGN_CLASS: Record<DataTableColumnAlign, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

function columnAlignClass(align?: DataTableColumnAlign): string {
  return ALIGN_CLASS[align ?? 'center'];
}

function toTableColumns<TData, TValue>(
  columns: Array<DataTableColumnDef<TData, TValue>>,
): Array<ColumnDef<TData, TValue>> {
  return columns.map(
    ({ minVisible: _minVisible, align: _align, maxWidth: _maxWidth, maxChars: _maxChars, ...columnDef }) =>
      columnDef,
  );
}

function columnLimitStyle(maxWidth?: string | number): CSSProperties | undefined {
  const resolved = resolveDataTableMaxWidth(maxWidth);
  return resolved ? { maxWidth: resolved } : undefined;
}

function renderTruncatedCellContent<TData>(
  cell: Cell<TData, unknown>,
  limits: { maxWidth?: string | number; maxChars?: number },
): ReactNode {
  const { maxWidth, maxChars } = limits;
  const hasCustomCell = Boolean(cell.column.columnDef.cell);
  const rawValue = cell.getValue();
  const stringValue = typeof rawValue === 'string' ? rawValue : undefined;

  let content: ReactNode = flexRender(cell.column.columnDef.cell, cell.getContext());
  if (maxChars && stringValue && !hasCustomCell) {
    content = truncateChars(stringValue, maxChars);
  }

  if (maxWidth === undefined && maxChars === undefined) {
    return content;
  }

  const title =
    stringValue && maxChars && stringValue.length > maxChars
      ? stringValue
      : maxWidth !== undefined && stringValue
        ? stringValue
        : undefined;

  return (
    <div
      className={cn('min-w-0', maxWidth !== undefined && 'truncate')}
      style={columnLimitStyle(maxWidth)}
      title={title}
    >
      {content}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Generic shadcn-pattern data table built on TanStack Table.
 *
 * Usage: `<DataTable columns={columns} data={data} />`
 *
 * For typing column arrays so they can be declared and reused independently of
 * the table, see `DataTableColumns` in `@llaab/ui/lib/data-table-utils`.
 */
export function DataTable<TData, TValue = unknown>({
  columns,
  data,
  emptyMessage = 'No results.',
  options,
}: DataTableProps<TData, TValue>) {
  const tableColumns = useMemo(() => toTableColumns(columns), [columns]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 25 });

  const { visibilityClassByColumnId, alignClassByColumnId, limitByColumnId } = useMemo(() => {
    const visibility = new Map<string, string>();
    const align = new Map<string, string>();
    const limits = new Map<string, { maxWidth?: string | number; maxChars?: number }>();

    for (const column of columns) {
      const columnId = resolveColumnId(column);
      if (!columnId) continue;

      visibility.set(columnId, minVisibleTableCellClass(column.minVisible));
      align.set(columnId, columnAlignClass(column.align));
      if (column.maxWidth !== undefined || column.maxChars !== undefined) {
        limits.set(columnId, { maxWidth: column.maxWidth, maxChars: column.maxChars });
      }
    }

    return { visibilityClassByColumnId: visibility, alignClassByColumnId: align, limitByColumnId: limits };
  }, [columns]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onPaginationChange: setPagination,
    state: { pagination },
    ...options,
  });
  const rowCount = table.getPrePaginationRowModel().rows.length;
  const page = table.getState().pagination.pageIndex + 1;
  const { pageSize } = table.getState().pagination;
  const pageCount = Math.max(1, table.getPageCount());
  const pageStart = rowCount === 0 ? 0 : table.getState().pagination.pageIndex * pageSize + 1;
  const pageEnd = Math.min(page * pageSize, rowCount);

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    className={cn(
                      visibilityClassByColumnId.get(header.column.id),
                      alignClassByColumnId.get(header.column.id),
                    )}
                    style={columnLimitStyle(limitByColumnId.get(header.column.id)?.maxWidth)}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {row.getVisibleCells().map((cell) => {
                    const limits = limitByColumnId.get(cell.column.id);

                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          visibilityClassByColumnId.get(cell.column.id),
                          alignClassByColumnId.get(cell.column.id),
                        )}
                        style={columnLimitStyle(limits?.maxWidth)}
                      >
                        {limits
                          ? renderTruncatedCellContent(cell, limits)
                          : flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {rowCount > 0 ? (
        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 max-[720px]:grid-cols-1 max-[720px]:items-start">
          <p className="m-0 whitespace-nowrap text-sm font-bold text-muted-foreground">
            <span className="text-foreground">
              {pageStart}-{pageEnd}
            </span>{' '}
            of {rowCount}
          </p>
          <Pagination className="w-auto justify-self-center max-[720px]:justify-self-start">
            <PaginationContent className="gap-1">
              <PaginationItem>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!table.getCanPreviousPage()}
                  onClick={() => table.previousPage()}
                >
                  Previous
                </Button>
              </PaginationItem>
              {paginationItems(page, pageCount).map((item, index) => (
                <PaginationItem key={`${item}-${index}`}>
                  {item === 'ellipsis' ? (
                    <span className="inline-flex w-6 items-center justify-center font-mono text-sm text-muted-foreground">
                      ...
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className={cn(
                        'min-w-8',
                        item === page &&
                          'border border-(--accent-border-dim) bg-(--surface) text-(--accent) hover:border-(--accent-border) hover:bg-(--surface-raised) hover:text-(--accent)',
                      )}
                      aria-current={item === page ? 'page' : undefined}
                      onClick={() => table.setPageIndex(item - 1)}
                    >
                      {item}
                    </Button>
                  )}
                </PaginationItem>
              ))}
              <PaginationItem>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={!table.getCanNextPage()}
                  onClick={() => table.nextPage()}
                >
                  Next
                </Button>
              </PaginationItem>
            </PaginationContent>
          </Pagination>
          <label className="flex items-center justify-self-end gap-2 whitespace-nowrap text-sm text-muted-foreground max-[720px]:justify-self-start">
            <span>show</span>
            <Select value={String(pageSize)} onValueChange={(value) => table.setPageSize(Number(value))}>
              <SelectTrigger size="sm" aria-label="Items per page" className="w-21">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        </div>
      ) : null}
    </div>
  );
}
