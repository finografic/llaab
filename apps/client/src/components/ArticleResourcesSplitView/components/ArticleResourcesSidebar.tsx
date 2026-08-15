import { BadgeCheckIcon } from '@llaab/icons';
import { cn } from '@llaab/ui/lib/utils';
import { ExtractionModelCard } from 'components/ExtractionModelCard';
import { RowDensityToggle } from 'components/RowDensityToggle/RowDensityToggle';
import { Col, Container, Row } from 'components/ui/grid';
import {
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInput,
} from 'components/ui/sidebar';
import { usePersistedUiState } from 'queries/ui-state';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ResourceNode } from '@llaab/schemas';
import type { RowDensity } from 'components/RowDensityToggle/RowDensityToggle';
import type { ChangeEvent, KeyboardEvent, MouseEvent } from 'react';

import { fmtListDateNumeric } from '../../TranscriptsSplitView/transcript-split.utils';
import styles from './ArticleResourcesSidebar.module.css';

export interface ArticleResourcesSidebarProps {
  resources: ResourceNode[];
  selectedId?: string;
  canonicalIdeaCountsByResourceId?: ReadonlyMap<string, number>;
}

function safeResourceSite(resource: ResourceNode): string | undefined {
  if (resource.site_name) return resource.site_name;
  if (resource.author) return resource.author;
  if (!resource.url) return undefined;

  try {
    return new URL(resource.url).hostname;
  } catch {
    return undefined;
  }
}

export function ArticleResourcesSidebar({
  resources,
  selectedId,
  canonicalIdeaCountsByResourceId,
}: ArticleResourcesSidebarProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const { value: selectedSites, setValue: setSelectedSites } = usePersistedUiState<string[]>(
    'articleResources.siteFilter',
    [],
  );
  const { value: rowDensity, setValue: setRowDensity } = usePersistedUiState<RowDensity>(
    'articleResources.rowDensity',
    'condensed',
  );
  const isCondensed = rowDensity === 'condensed';

  const siteOptions = useMemo(() => {
    const sites = new Set<string>();
    for (const resource of resources) {
      const site = safeResourceSite(resource);
      if (site) sites.add(site);
    }
    return Array.from(sites).toSorted((a, b) => a.localeCompare(b));
  }, [resources]);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    return resources.filter((resource) => {
      const site = safeResourceSite(resource);
      if (selectedSites.length > 0 && (!site || !selectedSites.includes(site))) return false;
      if (!normalized) return true;

      const haystack = [
        resource.title,
        resource.description,
        resource.author,
        resource.site_name,
        resource.url,
        ...resource.tags,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [query, resources, selectedSites]);

  function toggleSite(site: string) {
    setSelectedSites(
      selectedSites.includes(site)
        ? selectedSites.filter((value) => value !== site)
        : [...selectedSites, site],
    );
  }

  return (
    <div className={styles.shell}>
      <SidebarHeader className={styles.header}>
        <div className={styles.titleRow}>
          <div className={styles.titleGroup}>
            <div className={styles.title}>Articles</div>
            <span className="section__count">{resources.length}</span>
          </div>
          <RowDensityToggle value={rowDensity} onChange={setRowDensity} />
        </div>
        <SidebarInput
          placeholder="Search articles…"
          value={query}
          onChange={(event: ChangeEvent<HTMLInputElement>) => setQuery(event.target.value)}
        />
        {siteOptions.length > 0 ? (
          <div className={styles.filterRow}>
            {siteOptions.map((site) => (
              <button
                key={site}
                type="button"
                className={cn(styles.filterButton, selectedSites.includes(site) && styles.filterButtonActive)}
                onClick={() => toggleSite(site)}
              >
                {site}
              </button>
            ))}
          </div>
        ) : null}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            {filtered.length === 0 ? (
              <p className={styles.empty}>
                {query || selectedSites.length > 0 ? 'No articles match your filters.' : 'No articles yet.'}
              </p>
            ) : (
              filtered.map((resource) => {
                const isActive = resource.id === selectedId;
                const site = safeResourceSite(resource);
                const canonicalIdeaCount =
                  canonicalIdeaCountsByResourceId?.get(resource.id) ??
                  resource.canonical_coverage?.canonical_idea_ids.length ??
                  0;
                const isConsolidated = canonicalIdeaCount > 0;
                const displayIdeaCount = isConsolidated
                  ? canonicalIdeaCount
                  : resource.extracted_idea_ids.length;
                const hasLatency = resource.llm_duration_ms != null;
                const href = `/vault/resources/${resource.id}`;
                const sourceHref = resource.source_id ? `/vault/sources/${resource.source_id}` : undefined;

                function openResource() {
                  navigate(href);
                }

                function onCardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openResource();
                  }
                }

                function onSiteClick(event: MouseEvent<HTMLAnchorElement>) {
                  event.stopPropagation();
                }

                const siteNode =
                  site && sourceHref ? (
                    <Link to={sourceHref} onClick={onSiteClick} className={styles.siteLink}>
                      {site}
                    </Link>
                  ) : (
                    <span>{site}</span>
                  );

                return (
                  <div
                    key={resource.id}
                    role="link"
                    tabIndex={0}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={resource.title}
                    onClick={openResource}
                    onKeyDown={onCardKeyDown}
                    className={cn(styles.card, isActive && styles.cardActive)}
                  >
                    <Container className="py-2">
                      <Row justify="space-between" className="px-3">
                        {isCondensed ? (
                          <>
                            <Col xs={12} className={cn(styles.cardTitle, 'line-clamp-2')}>
                              {resource.title}
                            </Col>
                            {site ? (
                              <Col xs={12} className={cn(styles.cardMeta, 'pb-1')}>
                                {siteNode}
                              </Col>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <Col xs={8} className={cn(styles.cardTitle, 'line-clamp-2')}>
                              {resource.title}
                            </Col>
                            <Col xs={4} className={cn(styles.cardMeta, 'py-2 text-right')}>
                              {siteNode}
                            </Col>
                            {resource.description ? (
                              <Col xs={12} className={styles.description}>
                                <span className="line-clamp-2 whitespace-normal">{resource.description}</span>
                              </Col>
                            ) : null}
                          </>
                        )}

                        <Col xs={6} className={styles.metric}>
                          {isConsolidated ? (
                            <BadgeCheckIcon
                              size={14}
                              className="mr-0.5 shrink-0 text-(--consolidation-text)"
                              aria-label="Canonical ideas consolidated"
                            />
                          ) : (
                            <span aria-hidden className="mr-0.5 inline-block w-3.5 shrink-0" />
                          )}
                          <span className={isConsolidated ? styles.metricStrong : undefined}>
                            {displayIdeaCount} ideas
                          </span>
                        </Col>
                        <Col xs={6} className={styles.date}>
                          {fmtListDateNumeric(resource.created_at)}
                        </Col>
                        {!isCondensed && hasLatency ? (
                          <Col xs={12} className="flex items-center justify-end pt-2">
                            <ExtractionModelCard
                              variant="compact-bar"
                              model={resource.llm_model}
                              provider={resource.llm_provider}
                              promptTokens={resource.llm_prompt_tokens}
                              completionTokens={resource.llm_completion_tokens}
                              durationMs={resource.llm_duration_ms}
                              showTotalTokens={false}
                            />
                          </Col>
                        ) : null}
                      </Row>
                    </Container>
                  </div>
                );
              })
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </div>
  );
}
