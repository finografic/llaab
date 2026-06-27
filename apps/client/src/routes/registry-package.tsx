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
            <div className={styles.readme}>
              <div className={styles.installBox}>$ npm install {name}</div>
              <div className={styles.readmeContent}>
                {data.readme ? (
                  <div dangerouslySetInnerHTML={{ __html: renderReadme(data.readme) }} />
                ) : (
                  <p className={styles.readmeEmpty}>No readme available.</p>
                )}
              </div>
            </div>

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

function renderReadme(raw: string): string {
  // Basic markdown → HTML for the readme. Handles the most common patterns.
  // Full markdown rendering can be swapped in later (e.g. react-markdown).
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/```[\w]*\n([\s\S]*?)```/gm, '<pre><code>$1</code></pre>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
    )
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[h|p|u|o|l|p|c|b|e])(.+)$/gm, '<p>$1</p>');
}
