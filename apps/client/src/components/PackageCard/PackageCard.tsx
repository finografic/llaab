import { Link } from 'react-router-dom';
import type { NpmSearchPackage, PackageMetaResponse } from '@llaab/schemas';

import { formatDetailDate } from 'utils/format-date.utils';

import styles from './PackageCard.module.css';

function fmtDownloads(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

interface PackageCardProps {
  pkg: NpmSearchPackage | PackageMetaResponse;
  weeklyDownloads?: number;
}

export function PackageCard({ pkg, weeklyDownloads }: PackageCardProps) {
  const encodedName = encodeURIComponent(pkg.name);

  return (
    <Link to={`/registry/package/${encodedName}`} className={styles.card}>
      <div className={styles.header}>
        <span className={styles.name}>{pkg.name}</span>
        <span className={styles.version}>{pkg.version}</span>
        {pkg.license && <span className={styles.version}>{pkg.license}</span>}
      </div>

      {pkg.description && <p className={styles.description}>{pkg.description}</p>}

      <div className={styles.meta}>
        {(weeklyDownloads ?? (pkg as PackageMetaResponse).weeklyDownloads) ? (
          <span className={styles.metaItem}>
            {fmtDownloads((weeklyDownloads ?? (pkg as PackageMetaResponse).weeklyDownloads)!)} / week
          </span>
        ) : null}
        {pkg.date && <span className={styles.metaItem}>{formatDetailDate(pkg.date)}</span>}
      </div>

      {pkg.keywords && pkg.keywords.length > 0 && (
        <div className={styles.tags}>
          {pkg.keywords.slice(0, 6).map((kw) => (
            <span key={kw} className={styles.tag}>
              {kw}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
