'use client';

import { forwardRef } from 'react';
import { cn } from 'utils';
import type { ComponentPropsWithoutRef } from 'react';

/** A column span: 1–12, or `'content'` to shrink to the column's natural width. */
export type ColSpan = number | 'content';

export interface ColProps extends ComponentPropsWithoutRef<'div'> {
  /** Span at all sizes (mobile-first base, ≥ 0px). */
  'xs'?: ColSpan;
  /** Span at ≥ 640px. */
  'sm'?: ColSpan;
  /** Span at ≥ 768px. */
  'md'?: ColSpan;
  /** Span at ≥ 1024px. */
  'lg'?: ColSpan;
  /** Span at ≥ 1280px. */
  'xl'?: ColSpan;
  /** Span at ≥ 1536px (Tailwind `2xl`). Named `xxl` because `2xl` is not a valid JSX identifier. */
  'xxl'?: ColSpan;
  /** Alias of `xxl` — accepted for parity with Tailwind naming; `xxl` takes precedence if both are set. */
  '2xl'?: ColSpan;
}

/**
 * **Col** — responsive column inside a `Row`.
 *
 * Pass breakpoint props to control the column span at each viewport width. Omitting a
 * breakpoint inherits the previous breakpoint's span (mobile-first). Use `'content'`
 * to size the column to its natural width.
 *
 * @example
 *   ```tsx
 *   <Row>
 *     <Col xs={12} md={8}>
 *       Main
 *     </Col>
 *     <Col xs={12} md={4}>
 *       Aside
 *     </Col>
 *   </Row>;
 *   ```;
 */
const Col = forwardRef<HTMLDivElement, ColProps>(
  ({ xs, sm, md, lg, xl, xxl, '2xl': xxl2, className, ...props }, ref) => {
    const xxlValue = xxl ?? xxl2;

    return (
      <div
        ref={ref}
        className={cn(
          'grid-col',
          xs != null && `grid-col-xs-${xs}`,
          sm != null && `grid-col-sm-${sm}`,
          md != null && `grid-col-md-${md}`,
          lg != null && `grid-col-lg-${lg}`,
          xl != null && `grid-col-xl-${xl}`,
          xxlValue != null && `grid-col-xxl-${xxlValue}`,
          className,
        )}
        {...props}
      />
    );
  },
);

Col.displayName = 'Col';

export { Col };
