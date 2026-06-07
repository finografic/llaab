import { flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { ArrowUpDown } from 'lucide-react';
import type { Column, ColumnDef, TableOptions } from '@tanstack/react-table';

import { Button } from './button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './table';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Props for {@link DataTable}. Generic over the row shape `TData` so the same
 * component can render any tabular data — pass a typed `columns` array and the
 * matching `data` array.
 */
export interface DataTableProps<TData, TValue = unknown> {
  columns: Array<ColumnDef<TData, TValue>>;
  data: TData[];
  /** Message shown in place of rows when `data` is empty. */
  emptyMessage?: string;
  /** Extra `useReactTable` options (sorting, filtering, pagination row models, etc.). */
  options?: Partial<TableOptions<TData>>;
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
  return ({ column }: { column: Column<TData> }) => (
    <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
      {label}
      <ArrowUpDown />
    </Button>
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
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...options,
  });

  return (
    <div className="overflow-hidden rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
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
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
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
  );
}
