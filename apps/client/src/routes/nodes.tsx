import { DomainFilterBar } from 'components/DomainFilterBar/DomainFilterBar';
import { PageHero } from 'components/PageHero/PageHero';
import { CreateIdeaPanel } from 'forms/CreateIdeaPanel';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { useVaultNodes } from 'queries/vault';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { NodesFileList } from 'tables/NodesFileList/NodesFileList';
import type { LabNode } from '@llaab/schemas';

import {
  buildDomainFacets,
  domainFilterToSearchParam,
  filterByDomains,
  parseDomainFilterParam,
} from 'lib/domain-filters';
import { usePageTitle } from 'lib/use-page-title';

import styles from './nodes.module.css';

const CONTENT_TYPES = ['idea', 'resource', 'prompt', 'skill', 'instruction'] as const;

export function NodesPage() {
  usePageTitle('Nodes');

  const { data: all = [], isLoading } = useVaultNodes();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDomains = parseDomainFilterParam(searchParams.get('domain'));

  const nodes: LabNode[] = useMemo(
    () =>
      all
        .filter((n) => (CONTENT_TYPES as readonly string[]).includes(n.type))
        .toSorted((a, b) => b.created_at.localeCompare(a.created_at)),
    [all],
  );

  const domainFacets = useMemo(() => buildDomainFacets(nodes.map((node) => node.tags)), [nodes]);
  const filteredNodes = useMemo(() => filterByDomains(nodes, selectedDomains), [nodes, selectedDomains]);
  const typeCounts = Object.groupBy(filteredNodes, (n) => n.type);

  const setDomains = (domains: string[]) => {
    const next = new URLSearchParams(searchParams);
    const param = domainFilterToSearchParam(domains);
    if (param) next.set('domain', param);
    else next.delete('domain');
    setSearchParams(next, { replace: true });
  };

  return (
    <PageLayout
      hero={
        <PageHero
          eyebrow="Vault"
          title="Nodes"
          actions={<CreateIdeaPanel />}
          meta={
            <>
              <span>
                {filteredNodes.length} node{filteredNodes.length !== 1 ? 's' : ''}
                {filteredNodes.length !== nodes.length ? ` · ${nodes.length} total` : ''}
              </span>
              {Object.entries(typeCounts).map(([type, items]) => (
                <span key={type}>
                  {type} · {items?.length ?? 0}
                </span>
              ))}
            </>
          }
        />
      }
    >
      {!isLoading && nodes.length > 0 ? (
        <DomainFilterBar
          className={styles.domainFilters}
          options={domainFacets}
          selected={selectedDomains}
          onChange={setDomains}
          resultCount={filteredNodes.length}
          totalCount={nodes.length}
        />
      ) : null}

      {isLoading ? <p className="text-muted-foreground text-sm">Loading nodes…</p> : null}
      {!isLoading && nodes.length === 0 ? (
        <p className={styles.empty}>No nodes yet. Use the button above or ingest a video to get started.</p>
      ) : null}
      {!isLoading && nodes.length > 0 && filteredNodes.length === 0 ? (
        <p className="text-muted-foreground text-sm">No nodes match the current domain filters.</p>
      ) : null}
      {!isLoading && filteredNodes.length > 0 ? (
        <NodesFileList nodes={filteredNodes} prioritizeDomains={selectedDomains} />
      ) : null}
    </PageLayout>
  );
}
