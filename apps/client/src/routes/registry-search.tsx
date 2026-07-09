import { ArrowDownIcon, ArrowUpIcon, ChevronsUpDownIcon } from '@llaab/icons';
import { cn } from '@llaab/ui/lib/utils';
import { PackageCard } from 'components/PackageCard/PackageCard';
import { PageHero } from 'components/PageHero/PageHero';
import { Button } from 'components/ui/button';
import { Input } from 'components/ui/input';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { PageList } from 'layouts/PageList/PageList';
import { useNpmSearch } from 'queries/registry';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebounce } from 'use-debounce';
import type { NpmSearchResult } from '@llaab/schemas';

import { usePageTitle } from 'lib/use-page-title';

import styles from './registry-search.module.css';

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

function sortResults(results: NpmSearchResult[], sort: SortState | null): NpmSearchResult[] {
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

/** First click direction when activating a column from relevance (off). */
function defaultDirectionFor(column: SortColumn): SortDirection {
  return column === 'title' ? 'asc' : 'desc';
}

/**
 * Cycle: off → primary → opposite → off (relevance).
 * Primary: title A–Z; published/downloads newest / highest first.
 */
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
        sort.direction === defaultDirectionFor(column) ? 'reverse' : 'clear to relevance'
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

export function RegistrySearchPage() {
  usePageTitle('Library Registry');

  const [searchParams, setSearchParams] = useSearchParams();
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

  // Debounced input → live ?q= (npmx-style)
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

  // New search → restore npm relevance order
  useEffect(() => {
    setSort(null);
  }, [debouncedQuery]);

  const { data, isLoading } = useNpmSearch(debouncedQuery);
  const results = data?.objects;
  const sortedResults = useMemo(() => sortResults(results ?? [], sort), [results, sort]);

  const packageCountLabel = data != null ? `${data.total.toLocaleString()} packages found` : '\u00a0';

  function handleSort(column: SortColumn) {
    setSort((current) => nextSortState(current, column));
  }

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Registry"
          title="Libraries"
          meta={<span className={styles.packageCount}>{packageCountLabel}</span>}
        />
      }
    >
      <PageList width="wide">
        <div className={styles.searchRow}>
          <Input
            className={styles.searchInput}
            placeholder="Search npm packages…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
          />
        </div>

        {isLoading && <p className={styles.empty}>Searching…</p>}

        {!isLoading && debouncedQuery.length === 0 && (
          <p className={styles.empty}>Type a package name to search npm.</p>
        )}

        {!isLoading && debouncedQuery.length > 0 && (results?.length ?? 0) === 0 && (
          <p className={styles.empty}>No packages found for &ldquo;{debouncedQuery}&rdquo;.</p>
        )}

        {sortedResults.length > 0 && (
          <div className={styles.results}>
            <div className={styles.sortHeader} role="row">
              <div className={styles.sortTitleCol}>
                <SortHeaderButton column="title" sort={sort} onSort={handleSort}>
                  Title
                </SortHeaderButton>
              </div>
              <div className={styles.sortPublishedCol}>
                <SortHeaderButton column="published" sort={sort} onSort={handleSort}>
                  Last Publish
                </SortHeaderButton>
              </div>
              <div className={styles.sortDownloadsCol}>
                <SortHeaderButton column="downloads" sort={sort} onSort={handleSort}>
                  Downloads
                </SortHeaderButton>
              </div>
              {/* Spacer matches PackageCard pin column so header labels stay aligned */}
              <div className={styles.sortPinCol} aria-hidden />
            </div>
            {sortedResults.map((result) => (
              <PackageCard
                key={result.package.name}
                pkg={result.package}
                weeklyDownloads={result.downloads?.weekly}
                dependents={result.dependents}
              />
            ))}
          </div>
        )}
      </PageList>
    </PageLayout>
  );
}
