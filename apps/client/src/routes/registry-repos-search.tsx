import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from '@llaab/icons';
import { cn } from '@llaab/ui/lib/utils';
import { PackageCard } from 'components/PackageCard/PackageCard';
import { PageHero } from 'components/PageHero/PageHero';
import { Button } from 'components/ui/button';
import { Col, Row } from 'components/ui/grid';
import { Tabs, TabsContent, TabsList, TabsTrigger } from 'components/ui/tabs';
import { MIN_PINNED } from 'forms/RegistryAddPinForm/registry-add-pin-form.utils';
import { RegistryAddPinForm } from 'forms/RegistryAddPinForm/RegistryAddPinForm';
import { RegistrySearchCard } from 'forms/RegistryAddPinForm/RegistrySearchCard';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { PageList } from 'layouts/PageList/PageList';
import { useGithubRepoSearch, usePinnedRepositories } from 'queries/registry';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebounce } from 'use-debounce';
import type { GithubRepoSearchItem, PinnedRepository } from '@llaab/schemas';

import { usePageTitle } from 'lib/use-page-title';

import styles from './registry-repos-search.module.css';

type RegistryTab = 'pinned' | 'search';
type SortColumn = 'title' | 'updated' | 'stars';
type SortDirection = 'asc' | 'desc';

interface SortState {
  column: SortColumn;
  direction: SortDirection;
}

function compareStrings(a: string, b: string, direction: SortDirection): number {
  const cmp = a.localeCompare(b, undefined, { sensitivity: 'base' });
  return direction === 'asc' ? cmp : -cmp;
}

function compareNumbers(a: number, b: number, direction: SortDirection): number {
  const cmp = a - b;
  return direction === 'asc' ? cmp : -cmp;
}

function updatedTimestamp(repo: GithubRepoSearchItem): number {
  const ts = Date.parse(repo.pushedAt ?? repo.updatedAt);
  return Number.isFinite(ts) ? ts : 0;
}

function sortRepos(results: GithubRepoSearchItem[], sort: SortState | null): GithubRepoSearchItem[] {
  if (!sort) return results;

  return [...results].toSorted((a, b) => {
    switch (sort.column) {
      case 'title':
        return compareStrings(a.fullName, b.fullName, sort.direction);
      case 'updated':
        return compareNumbers(updatedTimestamp(a), updatedTimestamp(b), sort.direction);
      case 'stars':
        return compareNumbers(a.stars, b.stars, sort.direction);
      default: {
        const exhaustive: never = sort.column;
        return exhaustive;
      }
    }
  });
}

function defaultDirectionFor(column: SortColumn): SortDirection {
  return column === 'title' ? 'asc' : 'desc';
}

/** Cycle: off → primary → opposite → off (relevance / pin order). */
function nextSortState(current: SortState | null, column: SortColumn): SortState | null {
  if (current?.column !== column) {
    return { column, direction: defaultDirectionFor(column) };
  }
  const primary = defaultDirectionFor(column);
  if (current.direction === primary) {
    return { column, direction: primary === 'asc' ? 'desc' : 'asc' };
  }
  return null;
}

function pinToListItem(pin: PinnedRepository): GithubRepoSearchItem {
  return {
    fullName: pin.meta.fullName,
    name: pin.meta.name,
    owner: pin.meta.owner,
    description: pin.meta.description,
    topics: pin.meta.topics,
    language: pin.meta.language,
    stars: pin.meta.stars,
    forks: pin.meta.forks,
    openIssues: pin.meta.openIssues,
    license: pin.meta.license,
    updatedAt: pin.meta.updatedAt,
    pushedAt: pin.meta.pushedAt,
    htmlUrl: pin.meta.htmlUrl,
    homepage: pin.meta.homepage,
  };
}

function filterPins(pins: PinnedRepository[], query: string): PinnedRepository[] {
  const q = query.trim().toLowerCase();
  if (!q) return pins;
  return pins.filter((pin) => {
    const { fullName, description, topics, language } = pin.meta;
    if (fullName.toLowerCase().includes(q)) return true;
    if (description?.toLowerCase().includes(q)) return true;
    if (language?.toLowerCase().includes(q)) return true;
    return topics?.some((topic) => topic.toLowerCase().includes(q)) ?? false;
  });
}

function parseTab(raw: string | null): RegistryTab {
  return raw === 'search' ? 'search' : 'pinned';
}

function SortHeaderButton({
  column,
  sort,
  onSort,
  className,
  children,
}: {
  column: SortColumn;
  sort: SortState | null;
  onSort: (column: SortColumn) => void;
  className?: string;
  children: string;
}) {
  const isActive = sort?.column === column;
  const Icon = isActive ? (sort.direction === 'asc' ? ArrowUpIcon : ArrowDownIcon) : ChevronsUpDownIcon;

  const ariaSort = isActive
    ? `Sort by ${children}, ${sort.direction}ending — click to ${
        sort.direction === defaultDirectionFor(column) ? 'reverse' : 'clear to default order'
      }`
    : `Sort by ${children}`;

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn(styles.sortButton, isActive ? styles.sortButtonActive : styles.sortButtonIdle, className)}
      onClick={() => onSort(column)}
      aria-label={ariaSort}
      aria-pressed={isActive}
    >
      {children}
      <Icon className={styles.sortIcon} aria-hidden />
    </Button>
  );
}

function RepoResultsPanel({
  countLabel,
  isLoading,
  loadingLabel,
  emptyIdle,
  emptyNoMatch,
  results,
  sort,
  onSort,
}: {
  countLabel: string;
  isLoading: boolean;
  loadingLabel: string;
  emptyIdle: string | null;
  emptyNoMatch: string | null;
  results: GithubRepoSearchItem[];
  sort: SortState | null;
  onSort: (column: SortColumn) => void;
}) {
  return (
    <div className={styles.tabPanel}>
      <p className={styles.packageCount}>{countLabel}</p>

      {isLoading && <p className={styles.empty}>{loadingLabel}</p>}

      {!isLoading && emptyIdle ? <p className={styles.empty}>{emptyIdle}</p> : null}

      {!isLoading && emptyNoMatch ? <p className={styles.empty}>{emptyNoMatch}</p> : null}

      {!isLoading && results.length > 0 ? (
        <div className={styles.results}>
          <div className={styles.sortHeader} role="row">
            <div className={styles.sortTitleCol}>
              <SortHeaderButton column="title" sort={sort} onSort={onSort}>
                Title
              </SortHeaderButton>
            </div>
            <div className={styles.sortPublishedCol}>
              <SortHeaderButton column="updated" sort={sort} onSort={onSort}>
                Updated
              </SortHeaderButton>
            </div>
            <div className={styles.sortDownloadsCol}>
              <SortHeaderButton column="stars" sort={sort} onSort={onSort}>
                Stars
              </SortHeaderButton>
            </div>
            <div className={styles.sortPinCol} aria-hidden />
          </div>
          {results.map((repo) => (
            <PackageCard key={repo.fullName} variant="repo" repo={repo} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function RegistryReposSearchPage() {
  usePageTitle('Repository Registry');

  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTab(searchParams.get('tab'));
  const urlQuery = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);
  const [debouncedQuery] = useDebounce(query, 300);
  const lastPushedQuery = useRef(urlQuery);
  const [sort, setSort] = useState<SortState | null>(null);

  useEffect(() => {
    if (urlQuery === lastPushedQuery.current) return;
    lastPushedQuery.current = urlQuery;
    setQuery(urlQuery);
  }, [urlQuery]);

  useEffect(() => {
    if (debouncedQuery === urlQuery) return;
    lastPushedQuery.current = debouncedQuery;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (debouncedQuery) next.set('q', debouncedQuery);
        else next.delete('q');
        return next;
      },
      { replace: true },
    );
  }, [debouncedQuery, setSearchParams, urlQuery]);

  useEffect(() => {
    setSort(null);
  }, [debouncedQuery, tab]);

  const { data: pins = [], isLoading: pinsLoading } = usePinnedRepositories();
  const { data: searchData, isLoading: searchLoading } = useGithubRepoSearch(
    tab === 'search' ? debouncedQuery : '',
  );

  const pinnedResults = useMemo(() => {
    const filtered = filterPins(pins, debouncedQuery).map(pinToListItem);
    return sortRepos(filtered, sort);
  }, [pins, debouncedQuery, sort]);

  const searchResults = useMemo(() => sortRepos(searchData?.items ?? [], sort), [searchData?.items, sort]);

  function handleSort(column: SortColumn) {
    setSort((current) => nextSortState(current, column));
  }

  function handleTabChange(next: string) {
    const nextTab = parseTab(next);
    setQuery('');
    lastPushedQuery.current = '';
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (nextTab === 'pinned') params.delete('tab');
        else params.set('tab', nextTab);
        params.delete('q');
        return params;
      },
      { replace: true },
    );
  }

  const pinnedCountLabel =
    pins.length === 0 && !pinsLoading
      ? '0 pinned repositories'
      : `${pins.length.toLocaleString()} pinned ${pins.length === 1 ? 'repository' : 'repositories'} total`;

  const searchCountLabel =
    searchData != null ? `${searchData.total.toLocaleString()} repositories found` : '\u00a0';

  function handleQueryChange(value: string) {
    setQuery(value);
    if (tab === 'pinned' && !pinsLoading && pins.length < MIN_PINNED && value.trim().length > 0) {
      // Preserve the typed query — handleTabChange would clear it.
      setSearchParams(
        (prev) => {
          const params = new URLSearchParams(prev);
          params.set('tab', 'search');
          return params;
        },
        { replace: true },
      );
    }
  }

  const showSearch = true;
  const searchResultCount =
    tab === 'pinned'
      ? pinsLoading
        ? null
        : pinnedResults.length
      : searchLoading
        ? null
        : (searchData?.total ?? null);

  return (
    <PageLayout hero={<PageHero eyebrow="Registry" title="Repositories" />}>
      <PageList width="wide">
        <Row className={styles.toolbarRow} align="stretch">
          {showSearch ? (
            <Col xs={12} md={6} className={styles.toolbarCol}>
              <RegistrySearchCard
                kind="repositories"
                tab={tab}
                query={query}
                onQueryChange={handleQueryChange}
                resultCount={searchResultCount}
                isLoading={tab === 'search' ? searchLoading : pinsLoading}
                autoFocus
              />
            </Col>
          ) : null}
          <Col xs={12} md={6} className={styles.toolbarCol}>
            <RegistryAddPinForm />
          </Col>
        </Row>

        <Tabs value={tab} onValueChange={handleTabChange} className={styles.tabs}>
          <TabsList>
            <TabsTrigger value="pinned">Pinned</TabsTrigger>
            <TabsTrigger value="search">Search results</TabsTrigger>
          </TabsList>

          <TabsContent value="pinned" className={styles.tabsContent}>
            <RepoResultsPanel
              countLabel={pinsLoading ? '\u00a0' : pinnedCountLabel}
              isLoading={pinsLoading}
              loadingLabel="Loading pinned repositories…"
              emptyIdle={
                !pinsLoading && pins.length === 0
                  ? 'No pinned repositories yet. Drop a GitHub URL above, or switch to Search results.'
                  : null
              }
              emptyNoMatch={
                !pinsLoading && pins.length > 0 && pinnedResults.length === 0
                  ? `No pinned repositories match “${debouncedQuery}”.`
                  : null
              }
              results={pinnedResults}
              sort={sort}
              onSort={handleSort}
            />
          </TabsContent>

          <TabsContent value="search" className={styles.tabsContent}>
            <RepoResultsPanel
              countLabel={searchCountLabel}
              isLoading={searchLoading}
              loadingLabel="Searching…"
              emptyIdle={
                !searchLoading && debouncedQuery.length === 0
                  ? 'Type a repository name to search GitHub.'
                  : null
              }
              emptyNoMatch={
                !searchLoading && debouncedQuery.length > 0 && searchResults.length === 0
                  ? `No repositories found for “${debouncedQuery}”.`
                  : null
              }
              results={searchResults}
              sort={sort}
              onSort={handleSort}
            />
          </TabsContent>
        </Tabs>
      </PageList>
    </PageLayout>
  );
}
