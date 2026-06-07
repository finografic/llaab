# DataTable

Generic shadcn-pattern data table built on [TanStack Table](https://tanstack.com/table) and the
`Table` primitives in `table.tsx`. Renders any tabular data from a typed `columns` array and a
matching `data` array — see the [shadcn data table docs](https://ui.shadcn.com/docs/components/radix/data-table)
for the upstream pattern this follows.

## Basic usage

```tsx
import { DataTable } from '@llaab/ui/components/data-table';
import type { ColumnDef } from '@tanstack/react-table';

interface Payment {
  id: string;
  amount: number;
  status: 'pending' | 'processing' | 'success' | 'failed';
  email: string;
}

const columns: Array<ColumnDef<Payment>> = [
  { accessorKey: 'email', header: 'Email' },
  { accessorKey: 'status', header: 'Status' },
  { accessorKey: 'amount', header: 'Amount' },
];

<DataTable columns={columns} data={payments} />;
```

From `apps/client`, import via the `components/ui/*` alias instead:

```tsx
import { DataTable } from 'components/ui/data-table';
```

## Defining columns

Each entry in `columns` is a TanStack `ColumnDef<TData, TValue>`. The most common shapes:

- **Plain accessor column** — `{ accessorKey: 'email', header: 'Email' }` reads `row.email` and
  renders it as-is.
- **Computed column** — use `accessorFn` + an explicit `id` when the value isn't a direct property:
  `{ id: 'produced', accessorFn: (row) => row.produced_node_ids.length, header: 'Produced' }`.
- **Custom cell rendering** — provide a `cell` render function for badges, links, formatted dates,
  etc.: `cell: ({ row }) => <a href={...}>{row.original.title}</a>`.
- **Custom header rendering** — provide a `header` render function (or factory) instead of a
  string, e.g. for sortable columns (see below).

```tsx
const columns: DataTableColumns<RunNode> = [
  {
    accessorKey: 'title',
    header: 'Title',
    cell: ({ row }) => <a href={`/vault/runs/${row.original.id}`}>{row.original.title}</a>,
  },
];
```

## Sortable columns

Pass `getSortedRowModel()` via the `options` prop to enable sorting, then use the `sortableHeader`
factory exported alongside `DataTable` for the standard shadcn sortable-header button:

```tsx
import { DataTable, sortableHeader } from '@llaab/ui/components/data-table';
import { getSortedRowModel } from '@tanstack/react-table';

const columns: DataTableColumns<RunNode> = [
  { accessorKey: 'title', header: sortableHeader('Title') },
  { accessorKey: 'created_at', header: sortableHeader('Date') },
];

<DataTable columns={columns} data={runs} options={{ getSortedRowModel: getSortedRowModel() }} />;
```

Other TanStack row models (filtering, pagination, row selection, …) are enabled the same way —
pass them through `options` along with their corresponding `state` and `on*Change` handlers.

## Typing `columns` and `data` for reuse

Use `DataTableColumns<TData, TValue>` from `@llaab/ui/lib/data-table-utils` to type a column array
independently of any single `<DataTable />` instance. This lets you declare and export columns
once and reuse them across multiple tables for the same row shape:

```tsx
import type { DataTableColumns } from '@llaab/ui/lib/data-table-utils';

export const runColumns: DataTableColumns<RunNode> = [
  { accessorKey: 'title', header: 'Title' },
  { accessorKey: 'run_status', header: 'Status' },
];
```

## Other props

- `emptyMessage` — string shown in place of rows when `data` is empty (defaults to `'No results.'`).
- `options` — `Partial<TableOptions<TData>>` merged into `useReactTable`'s config; use it for
  sorting/filtering/pagination row models, `state`, and the matching `on*Change` callbacks.

## Example: extracting a reusable table component

If a `<DataTable columns={columns} data={data} />` pairing is used in more than one place, extract
it into its own component (as `RunsTable.tsx` does for `apps/client/src/pages/vault/runs/index.astro`):

```tsx
export interface RunsTableProps {
  runs: RunNode[];
}

export function RunsTable({ runs }: RunsTableProps) {
  return <DataTable columns={runColumns} data={runs} options={{ getSortedRowModel: getSortedRowModel() }} />;
}
```
