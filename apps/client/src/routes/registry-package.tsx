import { PageHero } from 'components/PageHero/PageHero';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { PageList } from 'layouts/PageList/PageList';
import { BookmarkCheckIcon, BookmarkIcon, ArrowLeftIcon } from 'lucide-react';
import { useNpmPackage, useIsLibraryPinned, usePinLibrary, useUnpinLibrary } from 'queries/registry';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';

import { usePageTitle } from 'lib/use-page-title';
import { formatDetailDate } from 'utils/format-date.utils';

import styles from './registry-package.module.css';

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
  const isPinned = useIsLibraryPinned(name);
  const pinLibrary = usePinLibrary();
  const unpinLibrary = useUnpinLibrary();

  usePageTitle(name || 'Package');

  async function handlePinToggle() {
    if (isPinned) {
      await unpinLibrary.mutateAsync(name);
      toast.success(`Unpinned ${name}`);
    } else {
      await pinLibrary.mutateAsync(name);
      toast.success(`Pinned ${name}`);
    }
  }

  const pinPending = pinLibrary.isPending || unpinLibrary.isPending;
  const depCount = data ? Object.keys(data.dependencies).length : 0;
  const peerDepCount = data ? Object.keys(data.peerDependencies).length : 0;

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Registry"
          title={name}
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
      <PageList width="wide">
        <Link to="/registry" className={styles.backLink}>
          <ArrowLeftIcon size={12} aria-hidden />
          Back to search
        </Link>

        {isLoading && <p className={styles.loading}>Loading…</p>}

        {!isLoading && data && (
          <div className={styles.layout}>
            {/* ── Left: install + readme ── */}
            <div className={styles.readmeColumn}>
              <div className={styles.installBox}>
                <span className={styles.installPrompt}>$</span>
                <span> npm install {name}</span>
              </div>

              {(data.hasTypes || data.isEsm) && (
                <div className={styles.badges}>
                  {data.hasTypes && <span className={styles.badge}>✓ Types</span>}
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
