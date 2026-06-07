/**
 * Tailwind CSS v4 default breakpoint scale (px).
 *
 * @see https://tailwindcss.com/docs/responsive-design
 */
export type ScreenClass = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';

export const BREAKPOINTS: Record<ScreenClass, number> = {
  'xs': 0,
  'sm': 640,
  'md': 768,
  'lg': 1024,
  'xl': 1280,
  '2xl': 1536,
} as const;

/** Breakpoint values excluding xs (0), useful for iteration. */
export const BREAKPOINT_VALUES = Object.values(BREAKPOINTS).slice(1);

/** Min-width media query conditions (no `@media` wrapper). */
export const QUERIES_MIN: Record<ScreenClass, string> = {
  'xs': '(min-width: 0px)',
  'sm': `(min-width: ${BREAKPOINTS.sm}px)`,
  'md': `(min-width: ${BREAKPOINTS.md}px)`,
  'lg': `(min-width: ${BREAKPOINTS.lg}px)`,
  'xl': `(min-width: ${BREAKPOINTS.xl}px)`,
  '2xl': `(min-width: ${BREAKPOINTS['2xl']}px)`,
} as const;

/** Max-width media query conditions (no `@media` wrapper). xs omitted — use base styles below sm. */
export const QUERIES_MAX: Omit<Record<ScreenClass, string>, 'xs'> = {
  'sm': `(max-width: ${BREAKPOINTS.sm}px)`,
  'md': `(max-width: ${BREAKPOINTS.md}px)`,
  'lg': `(max-width: ${BREAKPOINTS.lg}px)`,
  'xl': `(max-width: ${BREAKPOINTS.xl}px)`,
  '2xl': `(max-width: ${BREAKPOINTS['2xl']}px)`,
} as const;

export const MEDIA_QUERIES = {
  min: QUERIES_MIN,
  max: QUERIES_MAX,
} as const;

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
