import { PageHero } from 'components/PageHero/PageHero';
import { CreateIdeaPanel } from 'forms/CreateIdeaPanel';
import { PageLayout } from 'layouts/PageLayout/PageLayout';
import { useVaultNodes } from 'queries/vault';
import { NodesFileList } from 'tables/NodesFileList/NodesFileList';
import type { LabNode } from '@llaab/schemas';

import { usePageTitle } from 'lib/use-page-title';

import styles from './nodes.module.css';

const CONTENT_TYPES = ['idea', 'resource', 'prompt', 'skill', 'instruction'] as const;

export function NodesPage() {
  usePageTitle('Nodes');

  const { data: all = [], isLoading } = useVaultNodes();
  const nodes: LabNode[] = all
    .filter((n) => (CONTENT_TYPES as readonly string[]).includes(n.type))
    .toSorted((a, b) => b.created_at.localeCompare(a.created_at));

  const typeCounts = Object.groupBy(nodes, (n) => n.type);

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
                {nodes.length} node{nodes.length !== 1 ? 's' : ''}
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
      {isLoading ? <p className="text-muted-foreground text-sm">Loading nodes…</p> : null}
      {!isLoading && nodes.length === 0 ? (
        <p className={styles.empty}>No nodes yet. Use the button above or ingest a video to get started.</p>
      ) : null}
      {!isLoading && nodes.length > 0 ? <NodesFileList nodes={nodes} /> : null}
    </PageLayout>
  );
}
