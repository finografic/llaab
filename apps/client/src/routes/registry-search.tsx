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
import { useNpmSearch, usePinnedPackages } from 'queries/registry';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebounce } from 'use-debounce';
import type { NpmSearchResult, PackageTypesStatus, PinnedPackage } from '@llaab/schemas';

import { usePageTitle } from 'lib/use-page-title';

import styles from './registry-search.module.css';

type RegistryTab = 'pinned' | 'search';
type SortColumn = 'title' | 'published' | 'downloads';
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

function publishedTimestamp(result: NpmSearchResult): number {
  const ts = Date.parse(result.package.date);
  return Number.isFinite(ts) ? ts : 0;
}

function sortResults(results: PackageListItem[], sort: SortState | null): PackageListItem[] {
  if (!sort) return results;

  return [...results].toSorted((a, b) => {
    switch (sort.column) {
      case 'title':
        return compareStrings(a.package.name, b.package.name, sort.direction);
      case 'published':
        return compareNumbers(publishedTimestamp(a), publishedTimestamp(b), sort.direction);
      case 'downloads':
        return compareNumbers(a.downloads?.weekly ?? 0, b.downloads?.weekly ?? 0, sort.direction);
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

type PackageListItem = NpmSearchResult & {
  typesStatus?: PackageTypesStatus;
  resource?: PinnedPackage['resource'];
};

function pinToListItem(pin: PinnedPackage): PackageListItem {
  return {
    package: {
      name: pin.meta.name,
      version: pin.meta.version,
      description: pin.meta.description,
      keywords: pin.meta.keywords,
      date: pin.meta.date,
      links: pin.meta.links,
      license: pin.meta.license,
      author: pin.meta.author,
      maintainers: pin.meta.maintainers,
    },
    downloads: pin.meta.weeklyDownloads != null ? { weekly: pin.meta.weeklyDownloads } : undefined,
    typesStatus: pin.meta.typesStatus ?? 'none',
    resource: pin.resource,
  };
}

function filterPins(pins: PinnedPackage[], query: string): PinnedPackage[] {
  const q = query.trim().toLowerCase();
  if (!q) return pins;
  return pins.filter((pin) => {
    const { name, description, keywords } = pin.meta;
    if (name.toLowerCase().includes(q)) return true;
    if (description?.toLowerCase().includes(q)) return true;
    return keywords?.some((kw) => kw.toLowerCase().includes(q)) ?? false;
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

function PackageResultsPanel({
  countLabel,
  isLoading,
  loadingLabel,
  emptyIdle,
  emptyNoMatch,
  results,
  sort,
  onSort,
  showTypesStatus = false,
}: {
  countLabel: string;
  isLoading: boolean;
  loadingLabel: string;
  emptyIdle: string | null;
  emptyNoMatch: string | null;
  results: PackageListItem[];
  sort: SortState | null;
  onSort: (column: SortColumn) => void;
  /** Pinned tab only — Search omits so npm hits stay undistorted. */
  showTypesStatus?: boolean;
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
              <SortHeaderButton column="published" sort={sort} onSort={onSort}>
                Last Publish
              </SortHeaderButton>
            </div>
            <div className={styles.sortDownloadsCol}>
              <SortHeaderButton column="downloads" sort={sort} onSort={onSort}>
                Downloads
              </SortHeaderButton>
            </div>
            <div className={styles.sortPinCol} aria-hidden />
          </div>
          {results.map((result) => (
            <PackageCard
              key={result.package.name}
              pkg={result.package}
              weeklyDownloads={result.downloads?.weekly}
              dependents={result.dependents}
              typesStatus={showTypesStatus ? (result.typesStatus ?? 'none') : undefined}
              resource={showTypesStatus ? result.resource : undefined}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function RegistrySearchPage() {
  usePageTitle('Package Registry');

  const [searchParams, setSearchParams] = useSearchParams();
  const tab = parseTab(searchParams.get('tab'));
  const urlQuery = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);
  const [debouncedQuery] = useDebounce(query, 300);
  const lastPushedQuery = useRef(urlQuery);
  const [sort, setSort] = useState<SortState | null>(null);

  // Browser back/forward (or external ?q=) → input
  useEffect(() => {
    if (urlQuery === lastPushedQuery.current) return;
    lastPushedQuery.current = urlQuery;
    setQuery(urlQuery);
  }, [urlQuery]);

  // Debounced input → live ?q=
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

  // New query or tab → restore default order
  useEffect(() => {
    setSort(null);
  }, [debouncedQuery, tab]);

  const { data: pins = [], isLoading: pinsLoading } = usePinnedPackages();
  const { data: searchData, isLoading: searchLoading } = useNpmSearch(tab === 'search' ? debouncedQuery : '');

  const pinnedResults = useMemo(() => {
    const filtered = filterPins(pins, debouncedQuery).map(pinToListItem);
    return sortResults(filtered, sort);
  }, [pins, debouncedQuery, sort]);

  const searchResults = useMemo(
    () => sortResults(searchData?.objects ?? [], sort),
    [searchData?.objects, sort],
  );

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
      ? '0 pinned packages'
      : `${pins.length.toLocaleString()} pinned ${pins.length === 1 ? 'package' : 'packages'} total`;

  const searchCountLabel =
    searchData != null ? `${searchData.total.toLocaleString()} packages found` : '\u00a0';

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
    <PageLayout hero={<PageHero eyebrow="Registry" title="Packages" />}>
      <PageList width="wide">
        <Row className={styles.toolbarRow} align="stretch">
          {showSearch ? (
            <Col xs={12} md={6} className={styles.toolbarCol}>
              <RegistrySearchCard
                kind="packages"
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
            <PackageResultsPanel
              countLabel={pinsLoading ? '\u00a0' : pinnedCountLabel}
              isLoading={pinsLoading}
              loadingLabel="Loading pinned packages…"
              emptyIdle={
                !pinsLoading && pins.length === 0
                  ? 'No pinned packages yet. Drop an npm URL above, or switch to Search results.'
                  : null
              }
              emptyNoMatch={
                !pinsLoading && pins.length > 0 && pinnedResults.length === 0
                  ? `No pinned packages match “${debouncedQuery}”.`
                  : null
              }
              results={pinnedResults}
              sort={sort}
              onSort={handleSort}
              showTypesStatus
            />
          </TabsContent>

          <TabsContent value="search" className={styles.tabsContent}>
            <PackageResultsPanel
              countLabel={searchCountLabel}
              isLoading={searchLoading}
              loadingLabel="Searching…"
              emptyIdle={
                !searchLoading && debouncedQuery.length === 0 ? 'Type a package name to search npm.' : null
              }
              emptyNoMatch={
                !searchLoading && debouncedQuery.length > 0 && searchResults.length === 0
                  ? `No packages found for “${debouncedQuery}”.`
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
