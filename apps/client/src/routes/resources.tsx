import { ArticleResourcesSplitView } from 'components/ArticleResourcesSplitView';
import { buildArticleCanonicalIdeaCounts } from 'components/ArticleResourcesSplitView/article-resources.utils';
import { useVaultNodes } from 'queries/vault';
import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { CanonicalIdeaNode, ResourceNode } from '@llaab/schemas';

import { usePageTitle } from 'lib/use-page-title';

export function ResourcesPage() {
  usePageTitle('Articles');

  const { data: all = [], isLoading } = useVaultNodes({ type: 'resource' });
  const { data: canonicalIdeaNodes = [], isLoading: canonicalIdeasLoading } = useVaultNodes({
    type: 'canonical-idea',
  });
  const resources = useMemo(
    () =>
      (all as ResourceNode[])
        .filter((node) => node.type === 'resource' && node.resource_type === 'article')
        .toSorted((a, b) => b.created_at.localeCompare(a.created_at)),
    [all],
  );
  const latestResourceId = resources[0]?.id;
  const canonicalIdeaCountsByResourceId = useMemo(
    () =>
      buildArticleCanonicalIdeaCounts(
        resources,
        canonicalIdeaNodes.filter((node): node is CanonicalIdeaNode => node.type === 'canonical-idea'),
      ),
    [canonicalIdeaNodes, resources],
  );
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading || canonicalIdeasLoading) return;
    if (!latestResourceId) return;

    navigate(`/vault/resources/${latestResourceId}`, { replace: true });
  }, [canonicalIdeasLoading, isLoading, latestResourceId, navigate]);

  if (isLoading || canonicalIdeasLoading) {
    return <p className="text-muted-foreground p-6 text-sm">Loading articles…</p>;
  }

  return (
    <ArticleResourcesSplitView
      resources={resources}
      canonicalIdeaCountsByResourceId={canonicalIdeaCountsByResourceId}
    />
  );
}
