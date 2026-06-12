import { cn } from '@llaab/ui/lib/utils';
import type { CSSProperties, ReactNode } from 'react';

import styles from './PageLayout.module.css';

interface PageLayoutProps {
  hero?: ReactNode;
  aside?: ReactNode;
  asideWidth?: string;
  children: ReactNode;
}

export function PageLayout({ hero, aside, asideWidth = '200px', children }: PageLayoutProps) {
  const hasAside = aside != null;
  const bodyStyle = hasAside ? ({ '--aside-w': asideWidth } as CSSProperties) : undefined;

  return (
    <div className={styles.pageLayout}>
      {hero ? <div className={styles.heroZone}>{hero}</div> : null}

      <div
        className={cn(styles.pageBody, hasAside && styles.pageBodyWithAside)}
        style={bodyStyle}
        data-has-aside={hasAside || undefined}
      >
        {hasAside ? <aside className={styles.aside}>{aside}</aside> : null}
        <div className={styles.main}>{children}</div>
      </div>
    </div>
  );
}
