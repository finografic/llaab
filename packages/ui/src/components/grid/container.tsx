'use client';

import { forwardRef } from 'react';
import { cn } from 'utils';
import type { ComponentPropsWithoutRef } from 'react';

export interface ContainerProps extends ComponentPropsWithoutRef<'div'> {
  /** Removes the max-width constraint — container spans the full viewport width. */
  fluid?: boolean;
}

/**
 * **Container** — centred layout wrapper.
 *
 * Constrained to `var(--layout-content-max-width, 1200px)` by default.
 * Add `fluid` to disable the max-width and span the full viewport.
 * Pairs with `Row` and `Col` for a 12-column grid layout.
 */
const Container = forwardRef<HTMLDivElement, ContainerProps>(({ fluid, className, ...props }, ref) => (
  <div ref={ref} className={cn('grid-container', className)} data-fluid={fluid || undefined} {...props} />
));

Container.displayName = 'Container';

export { Container };
