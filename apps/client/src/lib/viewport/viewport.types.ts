import type { ScreenClass } from '@llaab/ui/lib/breakpoints';

export type { ScreenClass };

export type BreakpointMap<T> = Partial<Record<ScreenClass, T>>;

export interface MediaQueryProps {
  query: string;
  props: unknown;
}

export interface BreakpointDefaults extends BreakpointMap<number> {
  'xs'?: number;
  'sm': number;
  'md': number;
  'lg': number;
  'xl': number;
  '2xl'?: number;
}

export type MediaQueryType = 'min' | 'max';
export type MediaQueryMap = Record<MediaQueryType, Partial<BreakpointMap<number>>>;

export interface ColumnSizes extends BreakpointMap<number> {}
