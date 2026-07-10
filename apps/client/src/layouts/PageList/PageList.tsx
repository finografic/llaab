import { cn } from '@llaab/ui/lib/utils';
import type { ReactNode } from 'react';

import styles from './PageList.module.css';

interface PageListProps {
  width?: 'standard' | 'wide' | 'narrow' | 'full';
  children: ReactNode;
}

export function PageList({ width = 'standard', children }: PageListProps) {
  return (
    <div
      className={cn(
        styles.pageList,
        width === 'narrow' && styles.narrow,
        width === 'wide' && styles.wide,
        width === 'full' && styles.full,
      )}
      data-width={width}
    >
      {children}
    </div>
  );
}
