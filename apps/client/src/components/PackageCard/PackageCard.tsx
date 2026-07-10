import { BoxIcon, DownloadIcon, PinIcon, PinOffIcon, StarIcon } from '@llaab/icons';
import { cn } from '@llaab/ui/lib/utils';
import { Button } from 'components/ui/button';
import {
  useIsLibraryPinned,
  useIsRepositoryPinned,
  usePinLibrary,
  usePinRepository,
  useUnpinLibrary,
  useUnpinRepository,
} from 'queries/registry';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import type {
  GithubRepoSearchItem,
  NpmSearchPackage,
  PackageMetaResponse,
  PackageTypesStatus,
  RepoMetaResponse,
} from '@llaab/schemas';
import type { MouseEvent, ReactNode } from 'react';

import typescriptDeclarationIcon from '../../assets/typescript-declaration.svg';
import typescriptIcon from '../../assets/typescript.svg';
import styles from './PackageCard.module.css';

function formatWeeklyDownloads(n: number): string {
  return `${n.toLocaleString('en-US')} / week`;
}

function formatStars(n: number): string {
  return n.toLocaleString('en-US');
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

interface LibraryCardProps {
  variant?: 'library';
  pkg: NpmSearchPackage | PackageMetaResponse;
  weeklyDownloads?: number;
  dependents?: string;
  /** Pinned tab only — omit on Search so npm hits stay undistorted. */
  typesStatus?: PackageTypesStatus;
}

interface RepoCardProps {
  variant: 'repo';
  repo: GithubRepoSearchItem | RepoMetaResponse;
}

export type PackageCardProps = LibraryCardProps | RepoCardProps;

export function PackageCard(props: PackageCardProps) {
  if (props.variant === 'repo') {
    return <RepoPackageCard repo={props.repo} />;
  }
  return (
    <LibraryPackageCard
      pkg={props.pkg}
      weeklyDownloads={props.weeklyDownloads}
      dependents={props.dependents}
      typesStatus={props.typesStatus}
    />
  );
}

function LibraryPackageCard({
  pkg,
  weeklyDownloads,
  dependents,
  typesStatus,
}: Omit<LibraryCardProps, 'variant'>) {
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
          <div className={styles.titleBlock}>
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

function RepoPackageCard({ repo }: { repo: GithubRepoSearchItem | RepoMetaResponse }) {
  const isPinned = useIsRepositoryPinned(repo.fullName);
  const pinRepository = usePinRepository();
  const unpinRepository = useUnpinRepository();
  const pinPending = pinRepository.isPending || unpinRepository.isPending;
  const updated = repo.pushedAt ?? repo.updatedAt;
  const href = `/registry/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.name)}`;

  async function handlePinToggle(e: MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (pinPending) return;

    try {
      if (isPinned) {
        await unpinRepository.mutateAsync(repo.fullName);
        toast.success(`Unpinned ${repo.fullName}`);
      } else {
        await pinRepository.mutateAsync(repo.fullName);
        toast.success(`Pinned ${repo.fullName}`);
      }
    } catch {
      toast.error(isPinned ? `Failed to unpin ${repo.fullName}` : `Failed to pin ${repo.fullName}`);
    }
  }

  const metaParts: Array<{ key: string; node: ReactNode }> = [];
  if (repo.language) {
    metaParts.push({
      key: 'language',
      node: <span className={styles.metaItem}>{repo.language}</span>,
    });
  }
  if (repo.license) {
    metaParts.push({
      key: 'license',
      node: <span className={styles.metaItem}>{repo.license}</span>,
    });
  }

  return (
    <Link to={href} className={styles.card}>
      <div className={styles.body}>
        <div className={styles.main}>
          <div className={styles.titleBlock}>
            <div className={styles.header}>
              <span className={styles.name}>{repo.fullName}</span>
            </div>

            {repo.description ? <p className={styles.description}>{repo.description}</p> : null}

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

            {repo.topics && repo.topics.length > 0 ? (
              <div className={styles.tags}>
                {repo.topics.slice(0, 6).map((topic) => (
                  <span key={topic} className={styles.tag}>
                    {topic}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        <div className={styles.publishedCol}>
          {updated ? <span className={styles.published}>{formatPackageListDate(updated)}</span> : null}
        </div>

        <div className={styles.downloadsCol}>
          {repo.stars > 0 ? (
            <span className={styles.downloads}>
              <StarIcon className={styles.metaIcon} aria-hidden />
              <span>{formatStars(repo.stars)}</span>
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
            aria-label={isPinned ? `Unpin ${repo.fullName}` : `Pin ${repo.fullName}`}
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
