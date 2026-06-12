import { cn } from '@llaab/ui/lib/utils';
import type { ReactNode } from 'react';

import styles from './PageDetail.module.css';

interface PageDetailProps {
  variant?: 'narrow' | 'default';
  gap?: 'md' | 'lg';
  children: ReactNode;
}

export function PageDetail({ variant = 'default', gap = 'md', children }: PageDetailProps) {
  return (
    <div
      className={cn(styles.pageDetail, variant === 'narrow' && styles.narrow, gap === 'lg' && styles.gapLg)}
      data-variant={variant}
      data-gap={gap}
    >
      {children}
    </div>
  );
}
