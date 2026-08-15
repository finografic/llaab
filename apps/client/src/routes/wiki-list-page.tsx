import { KnowledgeWikiFilters } from 'components/KnowledgeWikiFilters/KnowledgeWikiFilters';
import { ListPagination, useListPagination } from 'components/ListPagination';
import { PageHero } from 'components/PageHero/PageHero';
import { RowDensityToggle } from 'components/RowDensityToggle/RowDensityToggle';
import { WikiListItem } from 'components/WikiListItem';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { PageList } from 'layouts/PageList/PageList';
import { useKnowledgeWikis } from 'queries/knowledge';
import { usePersistedUiState } from 'queries/ui-state';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { RowDensity } from 'components/RowDensityToggle/RowDensityToggle';

import {
  buildKnowledgeWikiFacets,
  filterKnowledgeWikis,
  knowledgeWikiFiltersToSearchParams,
  parseKnowledgeWikiFiltersFromSearchParams,
} from 'lib/knowledge-wiki-filters';
import { usePageTitle } from 'lib/use-page-title';

export function KnowledgeWikisPage() {
  usePageTitle('Knowledge wikis');
  const { data: wikis = [], isLoading, error } = useKnowledgeWikis();
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = parseKnowledgeWikiFiltersFromSearchParams(searchParams);
  const facets = useMemo(() => buildKnowledgeWikiFacets(wikis), [wikis]);
  const filteredWikis = useMemo(() => filterKnowledgeWikis(wikis, filters), [wikis, filters]);
  const paginationResetKey = searchParams.toString();
  const {
    page,
    pageCount,
    pageItems: pagedWikis,
    pageSize,
    setPage,
    setPageSize,
  } = useListPagination({
    items: filteredWikis,
    storageKey: 'wikis.pageSize',
    resetKey: paginationResetKey,
  });
  const { value: rowDensity, setValue: setRowDensity } = usePersistedUiState<RowDensity>(
    'wikis.rowDensity',
    'condensed',
  );

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Knowledge"
          title="Wikis"
          meta={
            <>
              {pagedWikis.length} shown
              {filteredWikis.length !== pagedWikis.length ? ` · ${filteredWikis.length} matched` : null}
              {filteredWikis.length !== wikis.length ? ` · ${wikis.length} total` : null}
            </>
          }
        />
      }
    >
      <PageList>
        <KnowledgeWikiFilters
          filters={filters}
          facets={facets}
          resultCount={filteredWikis.length}
          totalCount={wikis.length}
          onChange={(next) => setSearchParams(knowledgeWikiFiltersToSearchParams(next), { replace: true })}
          resultActions={<RowDensityToggle value={rowDensity} onChange={setRowDensity} />}
        />

        {isLoading ? <p className="text-muted-foreground text-sm">Loading wikis…</p> : null}
        {error ? <p className="text-destructive text-sm">{error.message}</p> : null}
        {!isLoading && !error && wikis.length === 0 ? (
          <p className="text-muted-foreground text-sm">No promoted wikis yet.</p>
        ) : null}
        {!isLoading && !error && wikis.length > 0 && filteredWikis.length === 0 ? (
          <p className="text-muted-foreground text-sm">No wikis match the current filters.</p>
        ) : null}
        {pagedWikis.map((wiki) => (
          <WikiListItem key={wiki.id} wiki={wiki} density={rowDensity} />
        ))}
        <ListPagination
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          totalItems={filteredWikis.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </PageList>
    </PageLayout>
  );
}
