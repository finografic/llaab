import { BoxIcon, DownloadIcon, PinIcon, PinOffIcon } from '@llaab/icons';
import { cn } from '@llaab/ui/lib/utils';
import { Button } from 'components/ui/button';
import { useIsLibraryPinned, usePinLibrary, useUnpinLibrary } from 'queries/registry';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import type { NpmSearchPackage, PackageMetaResponse } from '@llaab/schemas';
import type { MouseEvent, ReactNode } from 'react';

import styles from './PackageCard.module.css';

function formatWeeklyDownloads(n: number): string {
  return `${n.toLocaleString('en-US')} / week`;
}

function formatDependents(raw: string): string | null {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  const label = n === 1 ? 'dependent' : 'dependents';
  return `${n.toLocaleString('en-US')} ${label}`;
}

/** Npmx-style short date with zero-padded day, no time — e.g. `May 05, 2026`. */
function formatPackageListDate(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  const month = d.toLocaleString('en-US', { month: 'short' });
  const day = String(d.getDate()).padStart(2, '0');
  const year = d.getFullYear();
  return `${month} ${day}, ${year}`;
}

interface PackageCardProps {
  pkg: NpmSearchPackage | PackageMetaResponse;
  weeklyDownloads?: number;
  dependents?: string;
}

export function PackageCard({ pkg, weeklyDownloads, dependents }: PackageCardProps) {
  const encodedName = encodeURIComponent(pkg.name);
  const downloads = weeklyDownloads ?? (pkg as PackageMetaResponse).weeklyDownloads;
  const dependentsLabel = dependents ? formatDependents(dependents) : null;

  const isPinned = useIsLibraryPinned(pkg.name);
  const pinLibrary = usePinLibrary();
  const unpinLibrary = useUnpinLibrary();
  const pinPending = pinLibrary.isPending || unpinLibrary.isPending;

  async function handlePinToggle(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (pinPending) return;

    try {
      if (isPinned) {
        await unpinLibrary.mutateAsync(pkg.name);
        toast.success(`Unpinned ${pkg.name}`);
      } else {
        await pinLibrary.mutateAsync(pkg.name);
        toast.success(`Pinned ${pkg.name}`);
      }
    } catch {
      toast.error(isPinned ? `Failed to unpin ${pkg.name}` : `Failed to pin ${pkg.name}`);
    }
  }

  const metaParts: ReactNode[] = [];
  if (pkg.version) {
    metaParts.push(
      <span key="version" className={styles.metaItem}>
        v{pkg.version}
      </span>,
    );
  }
  if (pkg.date) {
    metaParts.push(
      <span key="date" className={styles.metaItem}>
        {formatPackageListDate(pkg.date)}
      </span>,
    );
  }
  if (dependentsLabel) {
    metaParts.push(
      <span key="dependents" className={styles.dependents}>
        <BoxIcon className={styles.metaIcon} aria-hidden />
        <span>{dependentsLabel}</span>
      </span>,
    );
  }

  return (
    <Link to={`/registry/package/${encodedName}`} className={styles.card}>
      <div className={styles.header}>
        <span className={styles.name}>{pkg.name}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className={cn(styles.pinButton, isPinned && styles.pinButtonActive)}
          onClick={handlePinToggle}
          disabled={pinPending}
          aria-label={isPinned ? `Unpin ${pkg.name}` : `Pin ${pkg.name}`}
          aria-pressed={isPinned}
        >
          {isPinned ? (
            <PinIcon className={styles.pinIcon} aria-hidden />
          ) : (
            <PinOffIcon className={styles.pinIcon} aria-hidden />
          )}
        </Button>
      </div>

      {pkg.description && <p className={styles.description}>{pkg.description}</p>}

      <div className={styles.meta}>
        {metaParts.length > 0 ? (
          <div className={styles.metaLeft}>
            {metaParts.map((part, i) => (
              <span key={i} className={styles.metaSegment}>
                {i > 0 ? (
                  <span className={styles.middot} aria-hidden>
                    ·
                  </span>
                ) : null}
                {part}
              </span>
            ))}
          </div>
        ) : null}
        {downloads != null && downloads > 0 ? (
          <span className={styles.downloads}>
            <DownloadIcon className={styles.metaIcon} aria-hidden />
            <span>{formatWeeklyDownloads(downloads)}</span>
          </span>
        ) : null}
      </div>

      {pkg.keywords && pkg.keywords.length > 0 ? (
        <div className={styles.tags}>
          {pkg.keywords.slice(0, 6).map((kw) => (
            <span key={kw} className={styles.tag}>
              {kw}
            </span>
          ))}
        </div>
      ) : null}
    </Link>
  );
}
