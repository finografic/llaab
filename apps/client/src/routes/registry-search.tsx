import { PackageCard } from 'components/PackageCard/PackageCard';
import { PageHero } from 'components/PageHero/PageHero';
import { Input } from 'components/ui/input';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { PageList } from 'layouts/PageList/PageList';
import { useNpmSearch } from 'queries/registry';
import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDebounce } from 'use-debounce';

import { usePageTitle } from 'lib/use-page-title';

import styles from './registry-search.module.css';

export function RegistrySearchPage() {
  usePageTitle('Library Registry');

  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get('q') ?? '';
  const [query, setQuery] = useState(urlQuery);
  const [debouncedQuery] = useDebounce(query, 300);
  const lastPushedQuery = useRef(urlQuery);

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

  const { data, isLoading } = useNpmSearch(debouncedQuery);
  const results = data?.objects ?? [];

  const packageCountLabel = data != null ? `${data.total.toLocaleString()} packages found` : '\u00a0';

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

        {!isLoading && debouncedQuery.length > 0 && results.length === 0 && (
          <p className={styles.empty}>No packages found for &ldquo;{debouncedQuery}&rdquo;.</p>
        )}

        {results.length > 0 && (
          <div className={styles.results}>
            {results.map((result) => (
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
