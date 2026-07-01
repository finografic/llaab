import { useMemo } from 'react';
import type { CSSProperties, ReactNode } from 'react';

import { getResponsiveBalancedColumns } from 'utils/balanced-grid.utils';
import type { BalancedGridOptions } from 'utils/balanced-grid.utils';

import styles from './BalancedGrid.module.css';

interface BalancedGridProps extends BalancedGridOptions {
  itemCount: number;
  className?: string;
  children: ReactNode;
}

export function BalancedGrid({ itemCount, className, children, maxColumns, minColumns }: BalancedGridProps) {
  const columns = useMemo(
    () => getResponsiveBalancedColumns(itemCount, { maxColumns, minColumns }),
    [itemCount, maxColumns, minColumns],
  );

  const style = {
    '--balanced-cols-sm': columns.sm,
    '--balanced-cols-md': columns.md,
    '--balanced-cols-lg': columns.lg,
  } as CSSProperties;

  return (
    <div className={className ? `${styles.grid} ${className}` : styles.grid} style={style}>
      {children}
    </div>
  );
}
