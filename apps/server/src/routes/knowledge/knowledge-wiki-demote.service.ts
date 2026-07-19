import { getNodeFilePath, listNodes, updateNode } from '@llaab/core';
import { formatIsoUtcSeconds } from '@llaab/schemas';
import type { WikiDraftNode } from '@llaab/schemas';

import { deleteKnowledgeWikiAndReferences } from './knowledge-wiki-delete.service.js';
import type { DeleteKnowledgeWikiResult } from './knowledge-wiki-delete.service.js';

export type DemoteKnowledgeWikiResult = DeleteKnowledgeWikiResult & {
  retainedDraftIds: string[];
};

/**
 * Unpublish a promoted wiki from canonical knowledge while retaining vault draft lineage.
 * Mechanically removes the knowledge file and inbound links; accepted drafts stay for audit/regen.
 */
export async function demoteKnowledgeWiki(wikiId: string): Promise<DemoteKnowledgeWikiResult> {
  const drafts = (await listNodes({ type: 'wiki-draft' }))
    .filter((node): node is WikiDraftNode => node.type === 'wiki-draft')
    .filter((draft) => draft.promoted_wiki_id === wikiId || draft.topic_key === wikiId);

  const reviewedAt = formatIsoUtcSeconds(new Date());
  const retainedDraftIds: string[] = [];

  for (const draft of drafts) {
    retainedDraftIds.push(draft.id);
    await updateNode(getNodeFilePath('wiki-draft', draft.id), () => ({
      ...draft,
      review_decisions: [
        ...draft.review_decisions,
        {
          at: reviewedAt,
          decision: 'demoted' as const,
          reason: 'Unpublished from canonical knowledge; vault lineage retained for audit/regeneration.',
        },
      ],
    }));
  }

  const deleted = await deleteKnowledgeWikiAndReferences(wikiId);
  return { ...deleted, retainedDraftIds };
}
