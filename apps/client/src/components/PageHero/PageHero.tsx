import { cn } from '@llaab/ui/lib/utils';
import type { ReactNode } from 'react';

import styles from './PageHero.module.css';

interface PageHeroProps {
  eyebrow?: string;
  title: string;
  /** Optional content rendered immediately before the title (e.g. brand icons). */
  titlePrefix?: ReactNode;
  /** Optional content rendered immediately after the title (e.g. status icons). */
  titleAddon?: ReactNode;
  bordered?: boolean;
  description?: ReactNode;
  descriptionClassName?: string;
  actions?: ReactNode;
  right?: ReactNode;
  meta?: ReactNode;
}

export function PageHero({
  eyebrow,
  title,
  titlePrefix,
  titleAddon,
  bordered = true,
  description,
  descriptionClassName,
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
              {titlePrefix}
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

          {description ? <p className={cn(styles.description, descriptionClassName)}>{description}</p> : null}
        </div>
      </div>

      {meta ? <div className={styles.meta}>{meta}</div> : null}
    </header>
  );
}
