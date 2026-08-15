import { ArticleDetail } from 'components/ArticleDetail';
import { useAppLeftSidebar } from 'layouts/AppLayout/AppLeftSidebarContext';
import { useMemo } from 'react';
import type { CanonicalIdeaNode, IdeaNode, ResourceNode } from '@llaab/schemas';
import type { ArticleExtractionRun } from 'components/ArticleDetail';

import { ArticleResourcesEmptyState } from './components/ArticleResourcesEmptyState';
import { ArticleResourcesSidebar } from './components/ArticleResourcesSidebar';

export interface ArticleResourcesSplitViewProps {
  resources: ResourceNode[];
  selectedId?: string;
  canonicalIdeaCountsByResourceId?: ReadonlyMap<string, number>;
  resource?: ResourceNode;
  extractedIdeas?: IdeaNode[];
  canonicalIdeas?: CanonicalIdeaNode[];
  extractionRuns?: ArticleExtractionRun[];
}

const EMPTY_IDEAS: IdeaNode[] = [];
const EMPTY_CANONICAL_IDEAS: CanonicalIdeaNode[] = [];
const EMPTY_EXTRACTION_RUNS: ArticleExtractionRun[] = [];
const ARTICLES_SIDEBAR_ID = 'vault-articles';
const ARTICLES_SIDEBAR_WIDTH = '500px';

function renderDetail(
  resource: ResourceNode | undefined,
  ideas: IdeaNode[],
  canonicalIdeas: CanonicalIdeaNode[],
  extractionRuns: ArticleExtractionRun[],
) {
  if (!resource) {
    return <ArticleResourcesEmptyState />;
  }

  return (
    <ArticleDetail
      key={resource.id}
      resource={resource}
      extractedIdeas={ideas}
      canonicalIdeas={canonicalIdeas}
      extractionRuns={extractionRuns}
    />
  );
}

export function ArticleResourcesSplitView({
  resources,
  selectedId,
  canonicalIdeaCountsByResourceId,
  resource,
  extractedIdeas,
  canonicalIdeas = EMPTY_CANONICAL_IDEAS,
  extractionRuns = EMPTY_EXTRACTION_RUNS,
}: ArticleResourcesSplitViewProps) {
  const ideas = extractedIdeas ?? EMPTY_IDEAS;
  const sidebarContent = useMemo(
    () => (
      <ArticleResourcesSidebar
        resources={resources}
        selectedId={selectedId}
        canonicalIdeaCountsByResourceId={canonicalIdeaCountsByResourceId}
      />
    ),
    [canonicalIdeaCountsByResourceId, resources, selectedId],
  );

  const leftSidebar = useMemo(
    () => ({
      id: ARTICLES_SIDEBAR_ID,
      content: sidebarContent,
      defaultOpen: true,
      minWidth: ARTICLES_SIDEBAR_WIDTH,
      maxWidth: ARTICLES_SIDEBAR_WIDTH,
      defaultWidth: ARTICLES_SIDEBAR_WIDTH,
    }),
    [sidebarContent],
  );

  useAppLeftSidebar(leftSidebar);

  return renderDetail(resource, ideas, canonicalIdeas, extractionRuns);
}
