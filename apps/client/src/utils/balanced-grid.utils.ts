export interface BalancedGridOptions {
  /** Widest column count to consider on large viewports. Default 3. */
  maxColumns?: number;
  /** Narrowest column count when searching for a balanced layout. Default 2. */
  minColumns?: number;
}

export interface ResponsiveBalancedColumns {
  sm: number;
  md: number;
  lg: number;
}

/**
 * Pick a column count that avoids a lone item on the last row.
 * Prefers the widest valid count up to `maxColumns`.
 */
export function getBalancedColumnCount(
  itemCount: number,
  { maxColumns = 3, minColumns = 2 }: BalancedGridOptions = {},
): number {
  if (itemCount <= 0) return 1;
  if (itemCount === 1) return 1;

  const cap = Math.min(itemCount, maxColumns);

  if (itemCount <= maxColumns) {
    return itemCount;
  }

  for (let columns = cap; columns >= minColumns; columns--) {
    if (itemCount % columns !== 1) {
      return columns;
    }
  }

  // Odd counts with a low max (e.g. 3 items at max 2) — stack to avoid a trailing orphan.
  if (cap === minColumns && itemCount % minColumns === 1) {
    return 1;
  }

  return cap;
}

/**
 * Responsive column counts for BalancedGrid breakpoints.
 * - sm: single column
 * - md: balanced up to 2 columns
 * - lg: balanced up to `maxColumns`
 */
export function getResponsiveBalancedColumns(
  itemCount: number,
  options: BalancedGridOptions = {},
): ResponsiveBalancedColumns {
  const maxColumns = options.maxColumns ?? 3;

  return {
    sm: 1,
    md: getBalancedColumnCount(itemCount, { ...options, maxColumns: Math.min(2, maxColumns) }),
    lg: getBalancedColumnCount(itemCount, { ...options, maxColumns }),
  };
}
