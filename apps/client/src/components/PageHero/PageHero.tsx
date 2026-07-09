import { cn } from '@llaab/ui/lib/utils';
import type { ReactNode } from 'react';

import styles from './PageHero.module.css';

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  /** Optional content rendered immediately after the title (e.g. status icons). */
  titleAddon?: ReactNode;
  bordered?: boolean;
  description?: ReactNode;
  actions?: ReactNode;
  right?: ReactNode;
  meta?: ReactNode;
}

export function PageHero({
  eyebrow,
  title,
  titleAddon,
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
            <div className={styles.titleGroup}>
              <h1 className={styles.title}>{title}</h1>
              {titleAddon}
            </div>
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
