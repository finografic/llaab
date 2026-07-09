import { BoxIcon, DownloadIcon, PinIcon, PinOffIcon } from '@llaab/icons';
import { cn } from '@llaab/ui/lib/utils';
import { Button } from 'components/ui/button';
import { useIsLibraryPinned, usePinLibrary, useUnpinLibrary } from 'queries/registry';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import type { NpmSearchPackage, PackageMetaResponse, PackageTypesStatus } from '@llaab/schemas';
import type { MouseEvent, ReactNode } from 'react';

import typescriptDeclarationIcon from '../../assets/typescript-declaration.svg';
import typescriptIcon from '../../assets/typescript.svg';
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

function TypesStatusIcon({ status }: { status: PackageTypesStatus }) {
  switch (status) {
    case 'included':
      return (
        <img
          src={typescriptIcon}
          alt="Includes TypeScript types"
          title="Includes TypeScript types"
          className={styles.typesIcon}
        />
      );
    case 'declarations':
      return (
        <img
          src={typescriptDeclarationIcon}
          alt="TypeScript declarations via @types"
          title="TypeScript declarations via @types"
          className={styles.typesIcon}
        />
      );
    case 'none':
      return null;
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

interface PackageCardProps {
  pkg: NpmSearchPackage | PackageMetaResponse;
  weeklyDownloads?: number;
  dependents?: string;
  /** Pinned tab only — omit on Search so npm hits stay undistorted. */
  typesStatus?: PackageTypesStatus;
}

export function PackageCard({ pkg, weeklyDownloads, dependents, typesStatus }: PackageCardProps) {
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

  const metaParts: Array<{ key: string; node: ReactNode }> = [];
  if (pkg.version) {
    metaParts.push({
      key: 'version',
      node: <span className={styles.metaItem}>v{pkg.version}</span>,
    });
  }
  if (dependentsLabel) {
    metaParts.push({
      key: 'dependents',
      node: (
        <span className={styles.dependents}>
          <BoxIcon className={styles.metaIcon} aria-hidden />
          <span>{dependentsLabel}</span>
        </span>
      ),
    });
  }

  return (
    <Link to={`/registry/package/${encodedName}`} className={styles.card}>
      <div className={styles.body}>
        <div className={styles.main}>
          <div className={styles.header}>
            <span className={styles.name}>{pkg.name}</span>
            {typesStatus != null ? <TypesStatusIcon status={typesStatus} /> : null}
          </div>

          {pkg.description ? <p className={styles.description}>{pkg.description}</p> : null}

          {metaParts.length > 0 ? (
            <div className={styles.meta}>
              {metaParts.map((part, i) => (
                <span key={part.key} className={styles.metaSegment}>
                  {i > 0 ? (
                    <span className={styles.middot} aria-hidden>
                      ·
                    </span>
                  ) : null}
                  {part.node}
                </span>
              ))}
            </div>
          ) : null}

          {pkg.keywords && pkg.keywords.length > 0 ? (
            <div className={styles.tags}>
              {pkg.keywords.slice(0, 6).map((kw) => (
                <span key={kw} className={styles.tag}>
                  {kw}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className={styles.publishedCol}>
          {pkg.date ? <span className={styles.published}>{formatPackageListDate(pkg.date)}</span> : null}
        </div>

        <div className={styles.downloadsCol}>
          {downloads != null && downloads > 0 ? (
            <span className={styles.downloads}>
              <DownloadIcon className={styles.metaIcon} aria-hidden />
              <span>{formatWeeklyDownloads(downloads)}</span>
            </span>
          ) : null}
        </div>

        <div className={styles.pinCol}>
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
      </div>
    </Link>
  );
}
