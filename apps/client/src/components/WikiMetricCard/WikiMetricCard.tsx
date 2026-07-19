import { Badge } from 'components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from 'components/ui/card';
import type { ReactNode } from 'react';

import styles from './WikiMetricCard.module.css';

export type WikiMetricCardVariant = 'default' | 'compact';

export interface WikiMetricCardProps {
  label: string;
  value?: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  badge?: ReactNode;
  badgeToneClassName?: string;
  variant?: WikiMetricCardVariant;
}

export function WikiMetricCard({
  label,
  value,
  detail,
  icon,
  badge,
  badgeToneClassName,
  variant = 'default',
}: WikiMetricCardProps) {
  const compact = variant === 'compact';

  return (
    <Card
      size={compact ? 'sm' : 'default'}
      className={compact ? `${styles.compactCard} ring-0 py-0` : styles.defaultCard}
      data-variant={variant}
    >
      <CardHeader className={styles.header}>
        <CardTitle className={styles.label}>
          {icon}
          {label}
        </CardTitle>
        {badge != null ? (
          <Badge variant="outline" className={badgeToneClassName}>
            {badge}
          </Badge>
        ) : null}
      </CardHeader>
      {!compact ? (
        <CardContent className={styles.value}>
          {value}
          {detail != null ? <span>{detail}</span> : null}
        </CardContent>
      ) : null}
    </Card>
  );
}

export function qualityMetricTone(score: number | undefined): string {
  if (score == null) return styles.neutral;
  if (score >= 80) return styles.good;
  if (score >= 60) return styles.warning;
  return styles.danger;
}
