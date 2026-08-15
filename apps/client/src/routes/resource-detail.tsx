import { ArticleResourcesSplitView } from 'components/ArticleResourcesSplitView';
import {
  buildArticleCanonicalIdeaCounts,
  canonicalIdeaBelongsToResource,
} from 'components/ArticleResourcesSplitView/article-resources.utils';
import { useVaultNode, useVaultNodes } from 'queries/vault';
import { useMemo } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import type { CanonicalIdeaNode, IdeaNode, ResourceNode, RunNode } from '@llaab/schemas';
import type { ArticleExtractionRun } from 'components/ArticleDetail';

const ARTICLE_RUN_SKILL_IDS = new Set([
  'ingest-article',
  'ingest-obsidian-web-clip',
  'extract-resource-ideas',
]);

function toArticleExtractionRuns(input: {
  resource: ResourceNode;
  runNodes: RunNode[];
  ideaNodes: IdeaNode[];
}): ArticleExtractionRun[] {
  const ideasById = new Map(input.ideaNodes.map((idea) => [idea.id, idea]));

  return input.runNodes
    .filter((run) => run.skill_id != null && ARTICLE_RUN_SKILL_IDS.has(run.skill_id))
    .filter((run) => run.produced_node_ids.includes(input.resource.id))
    .map((run) => {
      const ideaIds = run.produced_node_ids.filter((nodeId) => ideasById.has(nodeId));
      const ideas = ideaIds
        .map((ideaId) => ideasById.get(ideaId))
        .filter((idea): idea is IdeaNode => idea != null);
      return {
        id: run.id,
        title: run.title,
        startedAt: run.started_at,
        completedAt: run.completed_at,
        durationMs: run.duration_ms,
        model: run.llm?.model,
        provider: run.llm?.provider,
        promptTokens: run.llm?.prompt_tokens,
        completionTokens: run.llm?.completion_tokens,
        ideaIds,
        ideas,
      };
    })
    .toSorted((a, b) => {
      const aTime = a.startedAt ? Date.parse(a.startedAt) : 0;
      const bTime = b.startedAt ? Date.parse(b.startedAt) : 0;
      return bTime - aTime;
    });
}

export function ResourceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nodeQuery = useVaultNode(id);
  const resourcesQuery = useVaultNodes({ type: 'resource' });
  const ideasQuery = useVaultNodes({ type: 'idea' });
  const canonicalIdeasQuery = useVaultNodes({ type: 'canonical-idea' });
  const runsQuery = useVaultNodes({ type: 'run' });

  const resource = nodeQuery.data?.type === 'resource' ? (nodeQuery.data) : null;
  const resources = useMemo(
    () =>
      resourcesQuery.data
        ?.filter((node): node is ResourceNode => node.type === 'resource' && node.resource_type === 'article')
        .toSorted((a, b) => b.created_at.localeCompare(a.created_at)) ?? [],
    [resourcesQuery.data],
  );
  const extractedIdeas = useMemo(() => {
    if (!resource || !ideasQuery.data) return [];
    const ids = new Set(resource.extracted_idea_ids);
    return ideasQuery.data.filter((node): node is IdeaNode => node.type === 'idea' && ids.has(node.id));
  }, [ideasQuery.data, resource]);
  const canonicalIdeas = useMemo(() => {
    if (!resource || !canonicalIdeasQuery.data) return [];
    const coverageIds = new Set(resource.canonical_coverage?.canonical_idea_ids ?? []);
    if (coverageIds.size > 0) {
      return canonicalIdeasQuery.data.filter(
        (node): node is CanonicalIdeaNode => node.type === 'canonical-idea' && coverageIds.has(node.id),
      );
    }
    return canonicalIdeasQuery.data.filter(
      (node): node is CanonicalIdeaNode =>
        node.type === 'canonical-idea' && canonicalIdeaBelongsToResource(node, resource.id),
    );
  }, [canonicalIdeasQuery.data, resource]);
  const canonicalIdeaCountsByResourceId = useMemo(() => {
    const canonicalIdeaNodes =
      canonicalIdeasQuery.data?.filter((node): node is CanonicalIdeaNode => node.type === 'canonical-idea') ??
      [];
    return buildArticleCanonicalIdeaCounts(resources, canonicalIdeaNodes);
  }, [canonicalIdeasQuery.data, resources]);
  const extractionRuns = useMemo(() => {
    if (!resource || !runsQuery.data || !ideasQuery.data) return [];
    return toArticleExtractionRuns({
      resource,
      runNodes: runsQuery.data.filter((node): node is RunNode => node.type === 'run'),
      ideaNodes: ideasQuery.data.filter((node): node is IdeaNode => node.type === 'idea'),
    });
  }, [ideasQuery.data, resource, runsQuery.data]);

  if (
    nodeQuery.isLoading ||
    resourcesQuery.isLoading ||
    ideasQuery.isLoading ||
    canonicalIdeasQuery.isLoading ||
    runsQuery.isLoading
  ) {
    return <div className="p-6 text-sm text-muted-foreground">Loading article…</div>;
  }

  if (nodeQuery.isError || !nodeQuery.data) {
    return <div className="p-6 text-sm text-destructive">Article not found.</div>;
  }

  if (!resource) {
    return <Navigate to={`/vault/nodes/${id}`} replace />;
  }

  if (resource.resource_type !== 'article') {
    return <Navigate to={`/vault/nodes/${resource.id}`} replace />;
  }

  return (
    <ArticleResourcesSplitView
      resources={resources}
      selectedId={resource.id}
      canonicalIdeaCountsByResourceId={canonicalIdeaCountsByResourceId}
      resource={resource}
      extractedIdeas={extractedIdeas}
      canonicalIdeas={canonicalIdeas}
      extractionRuns={extractionRuns}
    />
  );
}
