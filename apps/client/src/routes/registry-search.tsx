import { PackageCard } from 'components/PackageCard/PackageCard';
import { PageHero } from 'components/PageHero/PageHero';
import { Input } from 'components/ui/input';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { PageList } from 'layouts/PageList/PageList';
import { useNpmSearch } from 'queries/registry';
import { useState } from 'react';
import { useDebounce } from 'use-debounce';

import { usePageTitle } from 'lib/use-page-title';

import styles from './registry-search.module.css';

export function RegistrySearchPage() {
  usePageTitle('Library Registry');

  const [query, setQuery] = useState('');
  const [debouncedQuery] = useDebounce(query, 300);

  const { data, isLoading } = useNpmSearch(debouncedQuery);
  const results = data?.objects ?? [];

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Registry"
          title="Libraries"
          meta={data ? `${data.total.toLocaleString()} packages found` : undefined}
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
              />
            ))}
          </div>
        )}
      </PageList>
    </PageLayout>
  );
}
