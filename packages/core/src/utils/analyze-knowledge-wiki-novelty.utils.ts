import type { KnowledgeWikiPage } from '@llaab/schemas';

export interface KnowledgeWikiNoveltyAnalysis {
  hasNovelEvidence: boolean;
  novelCanonicalIdeaIds: string[];
  representedCanonicalIdeaIds: string[];
  reason: string;
}

export function analyzeKnowledgeWikiNovelty(
  wiki: KnowledgeWikiPage,
  canonicalIdeaIds: string[],
): KnowledgeWikiNoveltyAnalysis {
  const represented = new Set(wiki.source_canonical_idea_ids);
  const novelCanonicalIdeaIds = canonicalIdeaIds.filter((id) => !represented.has(id));
  const representedCanonicalIdeaIds = canonicalIdeaIds.filter((id) => represented.has(id));
  return {
    hasNovelEvidence: novelCanonicalIdeaIds.length > 0,
    novelCanonicalIdeaIds,
    representedCanonicalIdeaIds,
    reason:
      novelCanonicalIdeaIds.length > 0
        ? `${novelCanonicalIdeaIds.length} selected canonical idea(s) are not represented by the promoted page.`
        : 'All selected canonical ideas are already represented by the promoted page.',
  };
}
