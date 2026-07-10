import { PageHero } from 'components/PageHero/PageHero';
import pageHeroStyles from 'components/PageHero/PageHero.module.css';
import { useSecondaryBackAction } from 'layouts/AppLayout/SecondaryActionBarContext';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { PageList } from 'layouts/PageList/PageList';
import { BookmarkCheckIcon, BookmarkIcon } from 'lucide-react';
import { useGithubRepo, useIsRepositoryPinned, usePinRepository, useUnpinRepository } from 'queries/registry';
import { useParams } from 'react-router-dom';
import { siGithub } from 'simple-icons';
import { toast } from 'sonner';

import { usePageTitle } from 'lib/use-page-title';
import { formatDetailDate } from 'utils/format-date.utils';

import styles from './registry-repo.module.css';

function GithubTitleIcon() {
  return (
    <svg role="img" viewBox="0 0 24 24" className={pageHeroStyles.titlePrefixIcon} aria-hidden>
      <title>{siGithub.title}</title>
      <path fill="currentColor" d={siGithub.path} />
    </svg>
  );
}

function fmtCount(n?: number): string {
  if (n == null) return '—';
  return n.toLocaleString('en-US');
}

export function RegistryRepoPage() {
  const { owner: encodedOwner = '', repo: encodedRepo = '' } = useParams<{
    owner: string;
    repo: string;
  }>();
  const owner = decodeURIComponent(encodedOwner);
  const repo = decodeURIComponent(encodedRepo);
  const fullName = owner && repo ? `${owner}/${repo}` : '';

  const { data, isLoading } = useGithubRepo(fullName);
  const isPinned = useIsRepositoryPinned(fullName);
  const pinRepository = usePinRepository();
  const unpinRepository = useUnpinRepository();

  usePageTitle(fullName || 'Repository');
  useSecondaryBackAction('/registry/repos', 'Back to search');

  async function handlePinToggle() {
    if (isPinned) {
      await unpinRepository.mutateAsync(fullName);
      toast.success(`Unpinned ${fullName}`);
    } else {
      await pinRepository.mutateAsync(fullName);
      toast.success(`Pinned ${fullName}`);
    }
  }

  const pinPending = pinRepository.isPending || unpinRepository.isPending;

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Registry"
          title={fullName}
          titlePrefix={<GithubTitleIcon />}
          right={
            <button
              type="button"
              className={`${styles.pinButton} ${isPinned ? styles.pinButtonActive : ''}`}
              onClick={handlePinToggle}
              disabled={pinPending}
              aria-label={isPinned ? `Unpin ${fullName}` : `Pin ${fullName}`}
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
            <div className={styles.readmeColumn}>
              {(data.language || data.isArchived || data.isFork || data.isTemplate) && (
                <div className={styles.badges}>
                  {data.language ? <span className={styles.badge}>{data.language}</span> : null}
                  {data.isArchived ? <span className={styles.badge}>Archived</span> : null}
                  {data.isFork ? <span className={styles.badge}>Fork</span> : null}
                  {data.isTemplate ? <span className={styles.badge}>Template</span> : null}
                </div>
              )}

              {data.description ? <p className={styles.repoDescription}>{data.description}</p> : null}

              {data.readmeHtml ? (
                <div className={styles.readmeContent} dangerouslySetInnerHTML={{ __html: data.readmeHtml }} />
              ) : (
                <p className={styles.readmeEmpty}>No readme available.</p>
              )}
            </div>

            <aside className={styles.sidebar}>
              <div className={styles.sidebarSection}>
                <span className={styles.sidebarLabel}>Stars</span>
                <span className={styles.sidebarValue}>{fmtCount(data.stars)}</span>
              </div>

              <div className={styles.sidebarSection}>
                <span className={styles.sidebarLabel}>Forks</span>
                <span className={styles.sidebarValue}>{fmtCount(data.forks)}</span>
              </div>

              <div className={styles.sidebarSection}>
                <span className={styles.sidebarLabel}>Watchers</span>
                <span className={styles.sidebarValue}>{fmtCount(data.watchers)}</span>
              </div>

              <div className={styles.sidebarSection}>
                <span className={styles.sidebarLabel}>Open Issues</span>
                <span className={styles.sidebarValue}>{fmtCount(data.openIssues)}</span>
              </div>

              {data.license && (
                <div className={styles.sidebarSection}>
                  <span className={styles.sidebarLabel}>License</span>
                  <span className={styles.sidebarValue}>{data.license}</span>
                </div>
              )}

              {data.defaultBranch && (
                <div className={styles.sidebarSection}>
                  <span className={styles.sidebarLabel}>Default Branch</span>
                  <span className={styles.sidebarValue}>{data.defaultBranch}</span>
                </div>
              )}

              {data.pushedAt && (
                <div className={styles.sidebarSection}>
                  <span className={styles.sidebarLabel}>Updated</span>
                  <span className={styles.sidebarValue}>{formatDetailDate(data.pushedAt)}</span>
                </div>
              )}

              {data.createdAt && (
                <div className={styles.sidebarSection}>
                  <span className={styles.sidebarLabel}>Created</span>
                  <span className={styles.sidebarValue}>{formatDetailDate(data.createdAt)}</span>
                </div>
              )}

              {data.languages.length > 0 && (
                <div className={styles.sidebarSection}>
                  <span className={styles.sidebarLabel}>Languages</span>
                  <div className={styles.langList}>
                    {data.languages.slice(0, 8).map((lang) => (
                      <div key={lang.name} className={styles.langRow}>
                        <span className={styles.langName}>{lang.name}</span>
                        <span className={styles.langPercent}>{lang.percent}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className={styles.sidebarSection}>
                <span className={styles.sidebarLabel}>Repository</span>
                <a
                  href={data.htmlUrl}
                  className={styles.sidebarLink}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {data.fullName}
                </a>
              </div>

              {data.homepage && (
                <div className={styles.sidebarSection}>
                  <span className={styles.sidebarLabel}>Homepage</span>
                  <a
                    href={data.homepage}
                    className={styles.sidebarLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {data.homepage}
                  </a>
                </div>
              )}

              {data.topics && data.topics.length > 0 && (
                <div className={styles.sidebarSection}>
                  <span className={styles.sidebarLabel}>Topics</span>
                  <div className={styles.tags}>
                    {data.topics.map((topic) => (
                      <span key={topic} className={styles.tag}>
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </aside>
          </div>
        )}
      </PageList>
    </PageLayout>
  );
}
