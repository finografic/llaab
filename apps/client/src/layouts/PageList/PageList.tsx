import { cn } from '@llaab/ui/lib/utils';
import type { ReactNode } from 'react';

import styles from './PageList.module.css';

interface PageListProps {
  width?: 'standard' | 'wide' | 'narrow';
  children: ReactNode;
}

export function PageList({ width = 'standard', children }: PageListProps) {
  return (
    <div
      className={cn(styles.pageList, width === 'narrow' && styles.narrow, width === 'wide' && styles.wide)}
      data-width={width}
    >
      {children}
    </div>
  );
}
