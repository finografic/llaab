import { PageHero } from 'components/PageHero/PageHero';
import { Badge } from 'components/ui/badge';
import { Button } from 'components/ui/button';
import { Col, Row } from 'components/ui/grid';
import { Input } from 'components/ui/input';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { PageList } from 'layouts/PageList/PageList';
import { SearchIcon } from 'lucide-react';
import { useVaultSearch } from 'queries/vault';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import type { NodeType } from '@llaab/schemas';
import type { FormEvent } from 'react';

import { usePageTitle } from 'lib/use-page-title';

import styles from './vault-search.module.css';

const DEFAULT_LIMIT = 25;

export function VaultSearchPage() {
  usePageTitle('Vault Search');

  const [searchParams, setSearchParams] = useSearchParams();
  const activeQuery = searchParams.get('q')?.trim() ?? '';
  const [draftQuery, setDraftQuery] = useState(activeQuery);
  const search = useVaultSearch({ limit: DEFAULT_LIMIT, query: activeQuery });
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
    const query = draftQuery.trim();
    setSearchParams(query ? { q: query } : {}, { replace: true });
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

        {search.data?.length ? (
          <section className={styles.results} aria-label="Search results">
            {search.data.map((result) => (
              <article className={styles.result} key={`${result.node_type}:${result.node_id}`}>
                <Row align="flex-start" gutterWidth={16}>
                  <Col>
                    <Row align="center" className={styles.badges} gutterWidth={8}>
                      <Col xs="content">
                        <Badge variant="outline">{result.node_type}</Badge>
                      </Col>
                      <Col xs="content">
                        <Badge variant="secondary">{result.status}</Badge>
                      </Col>
                      <Col xs="content">
                        <span className={styles.score}>score {result.score}</span>
                      </Col>
                    </Row>
                    <h2 className={styles.resultTitle}>
                      <Link to={nodeHref(result.node_type, result.node_id)}>{result.title}</Link>
                    </h2>
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
        ) : null}
      </PageList>
    </PageLayout>
  );
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
