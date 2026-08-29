/**
 * Breakpoint scale for the UI package.
 *
 * The numbers, media query strings and unit converters live in
 * `@finografic/core/viewport`, so one source of truth serves every repo and can generate
 * Tailwind's `@theme` block rather than being kept in step with it by hand. They are
 * re-exported here so existing call sites keep working unchanged.
 *
 * `minVisibleTableCellClass` deliberately stays local. Tailwind only emits classes it
 * finds by scanning source files, and it does not scan `node_modules` without an explicit
 * `@source` directive — so these class literals have to live inside the repo.
 */

import type { ScreenClass } from '@finografic/core/viewport';

export type { ScreenClass } from '@finografic/core/viewport';

export {
  BREAKPOINT_VALUES,
  BREAKPOINTS,
  MEDIA_QUERIES,
  QUERIES_MAX,
  QUERIES_MIN,
} from '@finografic/core/viewport';

/** Tailwind class literals — must be complete strings so the compiler detects them. */
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
