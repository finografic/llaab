import type { ScreenClass } from '@finografic/core/viewport';
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
 * (Tailwind mobile-first, matching `BREAKPOINTS` in `@finografic/core/viewport`).
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
 * Tailwind class literals for responsive column visibility.
 *
 * These live in the repo rather than in `@finografic/core`: Tailwind only emits classes it
 * finds by scanning source files, and it does not scan `node_modules` without an explicit
 * `@source` directive. They sit beside the table that uses them so they travel with it.
 *
 * Each value must be a complete string for the compiler to detect it.
 */
const MIN_VISIBLE_TABLE_CELL_CLASS = {
  'sm': 'hidden sm:table-cell',
  'md': 'hidden md:table-cell',
  'lg': 'hidden lg:table-cell',
  'xl': 'hidden xl:table-cell',
  '2xl': 'hidden 2xl:table-cell',
} as const satisfies Record<Exclude<ScreenClass, 'xs'>, string>;

/**
 * Tailwind classes for responsive table column visibility.
 * Hides the cell below `minVisible`; shows from that breakpoint up (viewport width).
 */
export function minVisibleTableCellClass(minVisible?: ScreenClass): string {
  if (!minVisible || minVisible === 'xs') return '';
  return MIN_VISIBLE_TABLE_CELL_CLASS[minVisible];
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
