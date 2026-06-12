import { cn } from '@llaab/ui/lib/utils';
import type { ReactNode } from 'react';

import styles from './PageHero.module.css';

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  bordered?: boolean;
  description?: ReactNode;
  actions?: ReactNode;
  right?: ReactNode;
  meta?: ReactNode;
}

export function PageHero({
  eyebrow,
  title,
  bordered = true,
  description,
  actions,
  right,
  meta,
}: PageHeroProps) {
  const hasActions = actions != null || right != null;

  return (
    <header
      className={cn(styles.pageHero, bordered && styles.bordered)}
      data-bordered={bordered || undefined}
    >
      <div className={styles.inner}>
        <div>
          {eyebrow ? <p className={cn('eyebrow', styles.eyebrow)}>{eyebrow}</p> : null}

          <div className={styles.titleRow}>
            <h1 className={styles.title}>{title}</h1>
            {hasActions ? (
              <div className={styles.actions}>
                {actions}
                {right}
              </div>
            ) : null}
          </div>

          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
      </div>

      {meta ? <div className={styles.meta}>{meta}</div> : null}
    </header>
  );
}
