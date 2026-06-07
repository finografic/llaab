import type { ColumnDef } from '@tanstack/react-table';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Shorthand for a typed column array — pairs with `DataTable`'s `columns` prop so
 * column definitions can be declared and exported independently of the table,
 * and reused across multiple `<DataTable />` instances for the same row shape.
 *
 * @example
 *   export const columns: DataTableColumns<Payment> = [{ accessorKey: 'email', header: 'Email' }];
 */
export type DataTableColumns<TData, TValue = unknown> = Array<ColumnDef<TData, TValue>>;
