import type { ScreenClass } from './breakpoints';
import type { ColumnDef } from '@tanstack/react-table';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DataTableColumnAlign = 'left' | 'center' | 'right';

/**
 * Column definition extended with optional responsive visibility and alignment.
 *
 * `minVisible` hides the column below the breakpoint and shows it from that width up
 * (Tailwind mobile-first, matching {@link BREAKPOINTS}).
 *
 * `align` sets horizontal text alignment on header and body cells (defaults to `center`).
 */
export type DataTableColumnDef<TData, TValue = unknown> = ColumnDef<TData, TValue> & {
  minVisible?: ScreenClass;
  align?: DataTableColumnAlign;
};

/**
 * Shorthand for a typed column array — pairs with `DataTable`'s `columns` prop so
 * column definitions can be declared and exported independently of the table,
 * and reused across multiple `<DataTable />` instances for the same row shape.
 *
 * @example
 *   export const columns: DataTableColumns<Payment> = [{ accessorKey: 'email', header: 'Email' }];
 */
export type DataTableColumns<TData, TValue = unknown> = Array<DataTableColumnDef<TData, TValue>>;

export type { ScreenClass };
