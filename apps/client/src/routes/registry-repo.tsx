import { PageHero } from 'components/PageHero/PageHero';
import pageHeroStyles from 'components/PageHero/PageHero.module.css';
import { RegistryInstallStats } from 'components/RegistryInstallStats/RegistryInstallStats';
import { RegistrySidebarPinButton } from 'components/RegistrySidebarPinButton/RegistrySidebarPinButton';
import { RegistrySidebarSectionLabel } from 'components/RegistrySidebarSectionLabel/RegistrySidebarSectionLabel';
import { RegistrySocketScores } from 'components/RegistrySocketScores/RegistrySocketScores';
import { Col, Row } from 'components/ui/grid';
import { useSecondaryBackAction } from 'layouts/AppLayout/SecondaryActionBarContext';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { PageList } from 'layouts/PageList/PageList';
import { BookmarkCheckIcon, BookmarkIcon } from 'lucide-react';
import {
  useGithubRepo,
  useGithubRepoNpm,
  useIsRepositoryPinned,
  usePinRepository,
  usePinnedRepositories,
  useUnpinRepository,
} from 'queries/registry';
import { Link, useParams } from 'react-router-dom';
import { siGithub } from 'simple-icons';
import { toast } from 'sonner';

import { usePageTitle } from 'lib/use-page-title';
import { formatDetailDateOnly } from 'utils/format-date.utils';
import { formatDownloadsChangeParts } from 'utils/format-downloads-change.utils';

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

function fmtDownloads(n?: number): string {
  if (n == null) return '—';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M / week`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K / week`;
  return `${String(n)} / week`;
}

function DownloadsChange({ changePercent }: { changePercent?: number }) {
  const parts = formatDownloadsChangeParts(changePercent);
  if (!parts) return null;
  const arrowClass =
    parts.tone === 'up'
      ? styles.downloadsChangeArrowUp
      : parts.tone === 'down'
        ? styles.downloadsChangeArrowDown
        : styles.downloadsChangeArrowFlat;
  return (
    <span className={styles.downloadsChange}>
      <span className={arrowClass}>{parts.arrow}</span>
      <span className={styles.downloadsChangePercent}>{parts.percent}</span>
    </span>
  );
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
  const { data: npmInfo } = useGithubRepoNpm(fullName);
  const isPinned = useIsRepositoryPinned(fullName);
  const { data: pins = [] } = usePinnedRepositories();
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
  const resource = pins.find((pin) => pin.fullName === fullName)?.resource;
  const npmPackage = npmInfo?.npmPackage;
  const weeklyDownloads = npmInfo?.weeklyDownloads;
  const weeklyDownloadsChangePercent = npmInfo?.weeklyDownloadsChangePercent;

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
          <Row className={styles.layoutRow} align="stretch" nogutter>
            <Col xs={12} className={styles.readmeColumn}>
              {(data.language || data.isArchived || data.isFork || data.isTemplate) && (
                <div className={styles.badges}>
                  {data.language ? <span className={styles.badge}>{data.language}</span> : null}
                  {data.isArchived ? <span className={styles.badge}>Archived</span> : null}
                  {data.isFork ? <span className={styles.badge}>Fork</span> : null}
                  {data.isTemplate ? <span className={styles.badge}>Template</span> : null}
                </div>
              )}

              {data.description ? <p className={styles.repoDescription}>{data.description}</p> : null}

              {npmPackage ? <RegistrySocketScores packageName={npmPackage} /> : null}

              {data.readmeHtml ? (
                <div className={styles.readmeContent} dangerouslySetInnerHTML={{ __html: data.readmeHtml }} />
              ) : (
                <p className={styles.readmeEmpty}>No readme available.</p>
              )}
            </Col>

            <Col xs={12} md="content" className={styles.sidebar}>
              <div className={styles.sidebarContent}>
                <div className={styles.sidebarSection}>
                  <div className={styles.sidebarLabelRow}>
                    <RegistrySidebarSectionLabel kind="repository" target={data.fullName}>
                      Repository
                    </RegistrySidebarSectionLabel>
                    <RegistrySidebarPinButton kind="repository" target={data.fullName} />
                  </div>
                  <a
                    href={data.htmlUrl}
                    className={styles.sidebarLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {data.fullName}
                  </a>
                </div>

                {npmPackage ? (
                  <div className={styles.sidebarSection}>
                    <div className={styles.sidebarLabelRow}>
                      <RegistrySidebarSectionLabel kind="package" target={npmPackage}>
                        Package
                      </RegistrySidebarSectionLabel>
                      <RegistrySidebarPinButton kind="package" target={npmPackage} />
                    </div>
                    <a
                      href={`https://npmx.dev/package/${encodeURIComponent(npmPackage)}`}
                      className={styles.sidebarLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      npmx.dev/package/{npmPackage}
                    </a>
                    <a
                      href={`https://www.npmjs.com/package/${encodeURIComponent(npmPackage)}`}
                      className={styles.sidebarLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      npmjs.com/package/{npmPackage}
                    </a>
                  </div>
                ) : null}

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

                {data.latestVersion && (
                  <div className={styles.sidebarSection}>
                    <span className={styles.sidebarLabel}>Version</span>
                    <span className={styles.sidebarValue}>{data.latestVersion}</span>
                  </div>
                )}

                {data.pushedAt && (
                  <div className={styles.sidebarSection}>
                    <span className={styles.sidebarLabel}>Last updated</span>
                    <span className={styles.sidebarValue}>{formatDetailDateOnly(data.pushedAt)}</span>
                  </div>
                )}

                {weeklyDownloads != null && (
                  <div className={styles.sidebarSection}>
                    <span className={styles.sidebarLabel}>Downloads</span>
                    <div className={styles.sidebarValueRow}>
                      <span className={styles.sidebarValue}>{fmtDownloads(weeklyDownloads)}</span>
                      <DownloadsChange changePercent={weeklyDownloadsChangePercent} />
                    </div>
                  </div>
                )}

                <div className={styles.sidebarSection}>
                  <span className={styles.sidebarLabel}>Stars</span>
                  <span className={styles.sidebarValue}>{fmtCount(data.stars)}</span>
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

                {npmPackage ? (
                  <RegistryInstallStats
                    packageName={npmPackage}
                    version={data.latestVersion?.replace(/^v/, '')}
                  />
                ) : null}

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

                {data.topics && data.topics.length > 0 && (
                  <div className={styles.sidebarSection}>
                    <span className={styles.sidebarLabel}>Tags</span>
                    <div className={styles.tags}>
                      {data.topics.map((topic) => (
                        <span key={topic} className={styles.tag}>
                          {topic}
                        </span>
                      ))}
                    </div>
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

                <div className={styles.sidebarSection}>
                  <span className={styles.sidebarLabel}>Maintainer</span>
                  <a
                    href={`https://github.com/${encodeURIComponent(data.owner)}`}
                    className={styles.sidebarLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {data.owner}
                  </a>
                </div>
              </div>
            </Col>
          </Row>
        )}
      </PageList>
    </PageLayout>
  );
}
