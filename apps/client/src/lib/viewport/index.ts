import {
  BREAKPOINTS,
  BREAKPOINT_VALUES,
  MEDIA_QUERIES,
  QUERIES_MAX,
  QUERIES_MIN,
  minVisibleTableCellClass,
} from '@llaab/ui/lib/breakpoints';
import type { ScreenClass } from '@llaab/ui/lib/breakpoints';

/** Pixel strings — e.g. `{ sm: '640px', ... }`. */
export const BREAKPOINTS_PX = Object.fromEntries(
  Object.entries(BREAKPOINTS).map(([key, value]) => [key, `${value}px`]),
) as Record<ScreenClass, string>;

export {
  BREAKPOINTS,
  BREAKPOINT_VALUES,
  MEDIA_QUERIES,
  QUERIES_MAX,
  QUERIES_MIN,
  minVisibleTableCellClass,
  type ScreenClass,
};

export type { BreakpointMap, ColumnSizes, MediaQueryMap, MediaQueryProps } from './viewport.types';
