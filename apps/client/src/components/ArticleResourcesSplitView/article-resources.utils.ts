import type { CanonicalIdeaNode, ResourceNode } from '@llaab/schemas';

export function canonicalIdeaBelongsToResource(idea: CanonicalIdeaNode, resourceId: string): boolean {
  return idea.source_node_id === resourceId || idea.transcript_id === resourceId;
}

export function buildArticleCanonicalIdeaCounts(
  resources: ResourceNode[],
  canonicalIdeas: CanonicalIdeaNode[],
): ReadonlyMap<string, number> {
  const fallbackCounts = new Map<string, number>();
  for (const idea of canonicalIdeas) {
    const resourceId = idea.source_node_type === 'resource' ? idea.source_node_id : idea.transcript_id;
    if (!resourceId) continue;
    fallbackCounts.set(resourceId, (fallbackCounts.get(resourceId) ?? 0) + 1);
  }

  const counts = new Map<string, number>();
  for (const resource of resources) {
    const coverageCount = resource.canonical_coverage?.canonical_idea_ids.length ?? 0;
    const fallbackCount = fallbackCounts.get(resource.id) ?? 0;
    const count = coverageCount > 0 ? coverageCount : fallbackCount;
    if (count > 0) counts.set(resource.id, count);
  }
  return counts;
}
