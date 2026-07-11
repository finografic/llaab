import { PageHero } from 'components/PageHero/PageHero';
import pageHeroStyles from 'components/PageHero/PageHero.module.css';
import { useSecondaryBackAction } from 'layouts/AppLayout/SecondaryActionBarContext';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { PageList } from 'layouts/PageList/PageList';
import { BookmarkCheckIcon, BookmarkIcon } from 'lucide-react';
import {
  useNpmPackage,
  useIsPackagePinned,
  usePinPackage,
  usePinnedPackages,
  useUnpinPackage,
} from 'queries/registry';
import { Link, useParams } from 'react-router-dom';
import { siNpm } from 'simple-icons';
import { toast } from 'sonner';
import type { PackageTypesStatus } from '@llaab/schemas';

import { usePageTitle } from 'lib/use-page-title';
import { formatDetailDate } from 'utils/format-date.utils';

import typescriptDeclarationIcon from '../assets/typescript-declaration.svg';
import typescriptIcon from '../assets/typescript.svg';
import styles from './registry-package.module.css';

function NpmTitleIcon() {
  return (
    <svg role="img" viewBox="0 0 24 24" className={pageHeroStyles.titlePrefixIcon} aria-hidden>
      <title>{siNpm.title}</title>
      <path fill="currentColor" d={siNpm.path} />
    </svg>
  );
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

function typesBadgeLabel(status: PackageTypesStatus, typesPackageName?: string): string | null {
  switch (status) {
    case 'included':
      return '✓ Types';
    case 'declarations':
      return typesPackageName ? `✓ ${typesPackageName}` : '✓ @types';
    case 'none':
      return null;
    default: {
      const exhaustive: never = status;
      return exhaustive;
    }
  }
}

function fmtDownloads(n?: number): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M / week`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K / week`;
  return `${String(n)} / week`;
}

export function RegistryPackagePage() {
  const { name: encodedName = '' } = useParams<{ name: string }>();
  const name = decodeURIComponent(encodedName);

  const { data, isLoading } = useNpmPackage(name);
  const isPinned = useIsPackagePinned(name);
  const { data: pins = [] } = usePinnedPackages();
  const pinPackageMutation = usePinPackage();
  const unpinPackageMutation = useUnpinPackage();

  usePageTitle(name || 'Package');
  useSecondaryBackAction('/registry/packages', 'Back to search');

  async function handlePinToggle() {
    if (isPinned) {
      await unpinPackageMutation.mutateAsync(name);
      toast.success(`Unpinned ${name}`);
    } else {
      await pinPackageMutation.mutateAsync(name);
      toast.success(`Pinned ${name}`);
    }
  }

  const pinPending = pinPackageMutation.isPending || unpinPackageMutation.isPending;
  const depCount = data ? Object.keys(data.dependencies).length : 0;
  const peerDepCount = data ? Object.keys(data.peerDependencies).length : 0;
  const typesStatus = data?.typesStatus ?? (data?.hasTypes ? 'included' : 'none');
  const typesBadge = data ? typesBadgeLabel(typesStatus, data.typesPackageName) : null;
  const resource = pins.find((pin) => pin.name === name)?.resource;

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Registry"
          title={name}
          titlePrefix={<NpmTitleIcon />}
          titleAddon={data ? <TypesStatusIcon status={typesStatus} /> : null}
          right={
            <button
              type="button"
              className={`${styles.pinButton} ${isPinned ? styles.pinButtonActive : ''}`}
              onClick={handlePinToggle}
              disabled={pinPending}
              aria-label={isPinned ? `Unpin ${name}` : `Pin ${name}`}
            >
              {isPinned ? (
                <BookmarkCheckIcon size={14} aria-hidden />
              ) : (
                <BookmarkIcon size={14} aria-hidden />
              )}
              {isPinned ? 'Pinned' : 'Pin'}
            </button>
          }
        />
      }
    >
      <PageList width="full">
        {isLoading && <p className={styles.loading}>Loading…</p>}

        {!isLoading && data && (
          <div className={styles.layout}>
            {/* ── Left: install + readme ── */}
            <div className={styles.readmeColumn}>
              <div className={styles.installBox}>
                <span className={styles.installPrompt}>$</span>
                <span> npm install {name}</span>
              </div>

              {(typesBadge || data.isEsm) && (
                <div className={styles.badges}>
                  {typesBadge ? <span className={styles.badge}>{typesBadge}</span> : null}
                  {data.isEsm && <span className={styles.badge}>✓ ESM</span>}
                </div>
              )}

              {data.readmeHtml ? (
                <div className={styles.readmeContent} dangerouslySetInnerHTML={{ __html: data.readmeHtml }} />
              ) : (
                <p className={styles.readmeEmpty}>No readme available.</p>
              )}
            </div>

            {/* ── Right: metadata sidebar ── */}
            <aside className={styles.sidebar}>
              <div className={styles.sidebarSection}>
                <span className={styles.sidebarLabel}>Version</span>
                <span className={styles.sidebarValue}>{data.version}</span>
              </div>

              {data.license && (
                <div className={styles.sidebarSection}>
                  <span className={styles.sidebarLabel}>License</span>
                  <span className={styles.sidebarValue}>{data.license}</span>
                </div>
              )}

              {data.weeklyDownloads != null && (
                <div className={styles.sidebarSection}>
                  <span className={styles.sidebarLabel}>Downloads</span>
                  <span className={styles.sidebarValue}>{fmtDownloads(data.weeklyDownloads)}</span>
                </div>
              )}

              {resource ? (
                <div className={styles.sidebarSection}>
                  <span className={styles.sidebarLabel}>Knowledge Resource</span>
                  {resource.id ? (
                    <Link to={`/vault/nodes/${resource.id}`} className={styles.sidebarLink}>
                      {resource.id}
                    </Link>
                  ) : (
                    <span className={styles.sidebarValue}>{resource.status.replace('_', ' ')}</span>
                  )}
                </div>
              ) : null}

              {data.date && (
                <div className={styles.sidebarSection}>
                  <span className={styles.sidebarLabel}>Published</span>
                  <span className={styles.sidebarValue}>{formatDetailDate(data.date)}</span>
                </div>
              )}

              {depCount > 0 && (
                <div className={styles.sidebarSection}>
                  <span className={styles.sidebarLabel}>Dependencies</span>
                  <div className={styles.depList}>
                    {Object.entries(data.dependencies).map(([dep, range]) => (
                      <div key={dep} className={styles.depRow}>
                        <Link to={`/registry/package/${encodeURIComponent(dep)}`} className={styles.depLink}>
                          {dep}
                        </Link>
                        <span className={styles.depRange}>{range}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {peerDepCount > 0 && (
                <div className={styles.sidebarSection}>
                  <span className={styles.sidebarLabel}>Peer Dependencies</span>
                  <div className={styles.depList}>
                    {Object.entries(data.peerDependencies).map(([dep, range]) => (
                      <div key={dep} className={styles.depRow}>
                        <Link to={`/registry/package/${encodeURIComponent(dep)}`} className={styles.depLink}>
                          {dep}
                        </Link>
                        <span className={styles.depRange}>{range}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {data.links.repository && (
                <div className={styles.sidebarSection}>
                  <span className={styles.sidebarLabel}>Repository</span>
                  <a
                    href={data.links.repository}
                    className={styles.sidebarLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {data.links.repository.replace('https://github.com/', '')}
                  </a>
                </div>
              )}

              {data.links.homepage && (
                <div className={styles.sidebarSection}>
                  <span className={styles.sidebarLabel}>Homepage</span>
                  <a
                    href={data.links.homepage}
                    className={styles.sidebarLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {data.links.homepage}
                  </a>
                </div>
              )}

              <div className={styles.sidebarSection}>
                <span className={styles.sidebarLabel}>npm</span>
                <a
                  href={data.links.npm}
                  className={styles.sidebarLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  npmjs.com/package/{name}
                </a>
              </div>

              {data.keywords && data.keywords.length > 0 && (
                <div className={styles.sidebarSection}>
                  <span className={styles.sidebarLabel}>Keywords</span>
                  <div className={styles.tags}>
                    {data.keywords.map((kw) => (
                      <span key={kw} className={styles.tag}>
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {data.maintainers && data.maintainers.length > 0 && (
                <div className={styles.sidebarSection}>
                  <span className={styles.sidebarLabel}>Maintainers</span>
                  {data.maintainers.map((m) => (
                    <span key={m.name ?? m.email} className={styles.sidebarValue}>
                      {m.name ?? m.email}
                    </span>
                  ))}
                </div>
              )}
            </aside>
          </div>
        )}
      </PageList>
    </PageLayout>
  );
}
