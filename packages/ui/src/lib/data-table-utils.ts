import type { ScreenClass } from './breakpoints';
import type { ColumnDef } from '@tanstack/react-table';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DataTableColumnAlign = 'left' | 'center' | 'right';

/** Optional truncation limits for a table column — use `maxWidth`, `maxChars`, or both. */
export interface DataTableColumnLimit {
  maxWidth?: string | number;
  maxChars?: number;
}

/**
 * Column definition extended with optional responsive visibility and alignment.
 *
 * `minVisible` hides the column below the breakpoint and shows it from that width up
 * (Tailwind mobile-first, matching {@link BREAKPOINTS}).
 *
 * `align` sets horizontal text alignment on header and body cells (defaults to `center`).
 *
 * `maxWidth` caps the column width (number values are treated as pixels).
 * `maxChars` truncates plain accessor values with an ellipsis suffix.
 */
export type DataTableColumnDef<TData, TValue = unknown> = ColumnDef<TData, TValue> &
  DataTableColumnLimit & {
    minVisible?: ScreenClass;
    align?: DataTableColumnAlign;
  };

export function resolveDataTableMaxWidth(maxWidth?: string | number): string | undefined {
  if (maxWidth === undefined) return undefined;
  return typeof maxWidth === 'number' ? `${maxWidth}px` : maxWidth;
}

export function truncateChars(text: string, maxChars: number): string {
  if (maxChars <= 0 || text.length <= maxChars) return text;
  if (maxChars <= 3) return text.slice(0, maxChars);
  return `${text.slice(0, maxChars - 3)}...`;
}

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
