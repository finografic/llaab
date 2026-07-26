import { NodeStatusSchema, NodeTypeSchema } from '@llaab/schemas';
import { PageHero } from 'components/PageHero/PageHero';
import { Badge } from 'components/ui/badge';
import { Button } from 'components/ui/button';
import { Col, Row } from 'components/ui/grid';
import { Input } from 'components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from 'components/ui/select';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { PageList } from 'layouts/PageList/PageList';
import { SearchIcon } from 'lucide-react';
import { useVaultSearch } from 'queries/vault';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { NodeStatus, NodeType } from '@llaab/schemas';
import type { VaultSearchResult } from 'queries/vault';
import type { FormEvent, ReactNode } from 'react';

import { usePageTitle } from 'lib/use-page-title';

import styles from './vault-search.module.css';

const DEFAULT_LIMIT = 25;
const ALL_FILTER = 'all';
const NODE_TYPE_OPTIONS = NodeTypeSchema.options;
const NODE_STATUS_OPTIONS = NodeStatusSchema.options;

export function VaultSearchPage() {
  usePageTitle('Vault Search');

  const [searchParams, setSearchParams] = useSearchParams();
  const activeQuery = searchParams.get('q')?.trim() ?? '';
  const activeType = normalizeNodeType(searchParams.get('type'));
  const activeStatus = normalizeNodeStatus(searchParams.get('status'));
  const [draftQuery, setDraftQuery] = useState(activeQuery);
  const search = useVaultSearch({
    limit: DEFAULT_LIMIT,
    query: activeQuery,
    status: activeStatus === ALL_FILTER ? undefined : activeStatus,
    type: activeType === ALL_FILTER ? undefined : activeType,
  });
  const groupedResults = useMemo(() => groupResultsByType(search.data ?? []), [search.data]);
  const resultLabel = useMemo(() => {
    if (!activeQuery) return 'Ready';
    if (search.isLoading) return 'Searching';
    return `${search.data?.length ?? 0} result${search.data?.length === 1 ? '' : 's'}`;
  }, [activeQuery, search.data?.length, search.isLoading]);

  useEffect(() => {
    setDraftQuery(activeQuery);
  }, [activeQuery]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    applySearchParams({ query: draftQuery.trim() });
  };

  const applySearchParams = ({
    query = activeQuery,
    status = activeStatus,
    type = activeType,
  }: {
    query?: string;
    status?: NodeStatus | typeof ALL_FILTER;
    type?: NodeType | typeof ALL_FILTER;
  }) => {
    const next = new URLSearchParams();
    if (query) next.set('q', query);
    if (type !== ALL_FILTER) next.set('type', type);
    if (status !== ALL_FILTER) next.set('status', status);
    setSearchParams(next, { replace: true });
  };

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Vault"
          title="Search"
          description="Ranked local search across vault nodes with snippets, match reasons, and provenance."
          meta={
            <>
              <span>{resultLabel}</span>
              <span>Local full-text</span>
            </>
          }
        />
      }
    >
      <PageList width="wide">
        <form className={styles.searchForm} onSubmit={submitSearch}>
          <Row align="flex-end" gutterWidth={12}>
            <Col>
              <label className={styles.label} htmlFor="vault-search-query">
                Query
              </label>
              <Input
                id="vault-search-query"
                className={styles.input}
                value={draftQuery}
                onChange={(event) => setDraftQuery(event.target.value)}
                placeholder="context assembly, retrieval, inbox..."
              />
            </Col>
            <Col xs="content">
              <Button type="submit">
                <SearchIcon aria-hidden="true" />
                Search
              </Button>
            </Col>
          </Row>
          <Row align="flex-end" className={styles.filterRow} gutterWidth={12}>
            <FilterCol label="Node type">
              <Select
                value={activeType}
                onValueChange={(value) => applySearchParams({ type: normalizeNodeType(value) })}
              >
                <SelectTrigger size="sm">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>All types</SelectItem>
                  {NODE_TYPE_OPTIONS.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterCol>
            <FilterCol label="Status">
              <Select
                value={activeStatus}
                onValueChange={(value) => applySearchParams({ status: normalizeNodeStatus(value) })}
              >
                <SelectTrigger size="sm">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_FILTER}>All statuses</SelectItem>
                  {NODE_STATUS_OPTIONS.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterCol>
            {activeType !== ALL_FILTER || activeStatus !== ALL_FILTER ? (
              <Col xs="content">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => applySearchParams({ status: ALL_FILTER, type: ALL_FILTER })}
                >
                  Clear filters
                </Button>
              </Col>
            ) : null}
          </Row>
        </form>

        {!activeQuery ? <p className={styles.empty}>Enter a query to search the local vault.</p> : null}
        {search.isLoading ? <p className={styles.empty}>Searching vault…</p> : null}
        {search.isError ? (
          <p className={styles.error}>
            {search.error instanceof Error ? search.error.message : 'Search failed.'}
          </p>
        ) : null}
        {activeQuery && !search.isLoading && !search.isError && search.data?.length === 0 ? (
          <p className={styles.empty}>No matching vault nodes.</p>
        ) : null}

        {groupedResults.length ? (
          <section className={styles.results} aria-label="Search results">
            {groupedResults.map((group) => (
              <section className={styles.resultGroup} key={group.type} aria-label={`${group.type} results`}>
                <Row align="center" className={styles.groupHeading} gutterWidth={8}>
                  <Col xs="content">
                    <h2>{group.type}</h2>
                  </Col>
                  <Col xs="content">
                    <Badge variant="outline">{group.results.length}</Badge>
                  </Col>
                </Row>
                {group.results.map((result) => (
                  <article className={styles.result} key={`${result.node_type}:${result.node_id}`}>
                    <Row align="flex-start" gutterWidth={16}>
                      <Col>
                        <Row align="center" className={styles.badges} gutterWidth={8}>
                          <Col xs="content">
                            <Badge variant="secondary">{result.status}</Badge>
                          </Col>
                          <Col xs="content">
                            <span className={styles.score}>score {result.score}</span>
                          </Col>
                        </Row>
                        <h3 className={styles.resultTitle}>
                          <Link to={nodeHref(result.node_type, result.node_id)}>{result.title}</Link>
                        </h3>
                        <p className={styles.snippet}>{result.snippet}</p>
                        <Row align="center" className={styles.matches} gutterWidth={8}>
                          {result.matches.map((match) => (
                            <Col key={`${match.field}:${match.value ?? ''}`} xs="content">
                              <Badge variant="outline">
                                {match.field}
                                {match.value ? `: ${match.value}` : ''}
                              </Badge>
                            </Col>
                          ))}
                        </Row>
                        {result.tags.length ? (
                          <Row align="center" className={styles.tags} gutterWidth={8}>
                            {result.tags.map((tag) => (
                              <Col key={tag} xs="content">
                                <span>{tag}</span>
                              </Col>
                            ))}
                          </Row>
                        ) : null}
                      </Col>
                      <Col xs="content">
                        <Button asChild variant="outline">
                          <Link to={nodeHref(result.node_type, result.node_id)}>Open</Link>
                        </Button>
                      </Col>
                    </Row>
                  </article>
                ))}
              </section>
            ))}
          </section>
        ) : null}
      </PageList>
    </PageLayout>
  );
}

function FilterCol({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Col xs={12} md={4} lg={3}>
      <span className={styles.label}>{label}</span>
      {children}
    </Col>
  );
}

function normalizeNodeType(value: string | null): NodeType | typeof ALL_FILTER {
  const parsed = NodeTypeSchema.safeParse(value);
  return parsed.success ? parsed.data : ALL_FILTER;
}

function normalizeNodeStatus(value: string | null): NodeStatus | typeof ALL_FILTER {
  const parsed = NodeStatusSchema.safeParse(value);
  return parsed.success ? parsed.data : ALL_FILTER;
}

function groupResultsByType(results: VaultSearchResult[]) {
  return NODE_TYPE_OPTIONS.map((type) => ({
    results: results.filter((result) => result.node_type === type),
    type,
  })).filter((group) => group.results.length > 0);
}

function nodeHref(type: NodeType, id: string): string {
  switch (type) {
    case 'transcript':
      return `/vault/transcripts/${id}`;
    case 'source':
      return `/vault/sources/${id}`;
    case 'run':
      return `/vault/runs/${id}`;
    case 'wiki-draft':
      return `/vault/wiki-drafts/${id}`;
    case 'wiki-candidate':
      return `/vault/wiki-candidates/${id}`;
    case 'canonical-idea':
    case 'decision':
    case 'idea':
    case 'instruction':
    case 'prompt':
    case 'resource':
    case 'skill':
      return `/vault/nodes/${id}`;
  }
}
