'use client';

import { forwardRef } from 'react';
import { cn } from 'utils';
import type { ComponentPropsWithoutRef, CSSProperties } from 'react';

export interface RowProps extends ComponentPropsWithoutRef<'div'> {
  /** Cross-axis alignment of child columns. Maps to `align-items`. */
  align?: 'flex-start' | 'center' | 'flex-end' | 'stretch';
  /** Main-axis distribution of child columns. Maps to `justify-content`. */
  justify?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  /** Flex direction override. */
  direction?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
  /** Controls column wrapping. */
  wrap?: 'wrap' | 'nowrap' | 'wrap-reverse';
  /** Removes horizontal column gutters. */
  nogutter?: boolean;
  /** Override the gutter width in pixels via `--grid-gutter`. */
  gutterWidth?: number;
}

/**
 * **Row** — flex row that houses `Col` components in the 12-column grid.
 *
 * Layout props (`align`, `justify`, `direction`, `wrap`) map directly to CSS values via
 * `data-*` attributes consumed by `grid.css`. Use `nogutter` to strip column padding,
 * or `gutterWidth` to set a custom gutter for this row subtree.
 */
const Row = forwardRef<HTMLDivElement, RowProps>(
  ({ align, justify, direction, wrap, nogutter, gutterWidth, className, style, ...props }, ref) => {
    const combinedStyle: CSSProperties =
      gutterWidth != null
        ? ({ '--grid-gutter': `${gutterWidth}px`, ...style } as CSSProperties)
        : (style ?? {});

    return (
      <div
        ref={ref}
        className={cn('grid-row', className)}
        data-align={align}
        data-justify={justify}
        data-direction={direction}
        data-wrap={wrap}
        data-nogutter={nogutter || undefined}
        style={combinedStyle}
        {...props}
      />
    );
  },
);

Row.displayName = 'Row';

export { Row };
