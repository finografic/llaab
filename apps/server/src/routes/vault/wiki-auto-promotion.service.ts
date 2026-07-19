import { getNodeFilePath, listKnowledgeWikis, readNodeByType, updateNode } from '@llaab/core';
import { formatIsoUtcSeconds } from '@llaab/schemas';
import type { KnowledgeWikiPage, WikiDraftNode } from '@llaab/schemas';

import { promoteCreateWikiDraft, promoteUpdateWikiDraft } from './wiki-promotion.service.js';

function nextDistinctTopicKey(draft: WikiDraftNode, reservedIds: Set<string>): string {
  if (!reservedIds.has(draft.topic_key)) return draft.topic_key;
  let suffix = 2;
  while (reservedIds.has(`${draft.topic_key}-${suffix}`)) suffix += 1;
  return `${draft.topic_key}-${suffix}`;
}

async function prepareAmbiguousDraft(draft: WikiDraftNode, reservedIds: Set<string>): Promise<WikiDraftNode> {
  const topicKey = nextDistinctTopicKey(draft, reservedIds);
  const result = await updateNode(getNodeFilePath('wiki-draft', draft.id), () => ({
    ...draft,
    operation: 'create' as const,
    topic_key: topicKey,
    topic_matches: [],
    warning: draft.warning
      ? `${draft.warning} Automatically published as a distinct topic.`
      : 'Automatically published as a distinct topic.',
  }));
  if (result.node.type !== 'wiki-draft') throw new Error('Prepared node is not a wiki draft.');
  reservedIds.add(topicKey);
  return result.node;
}

async function acceptRepresentedDraft(draft: WikiDraftNode, page: KnowledgeWikiPage): Promise<void> {
  const reviewedAt = formatIsoUtcSeconds(new Date());
  await updateNode(getNodeFilePath('wiki-draft', draft.id), () => ({
    ...draft,
    draft_status: 'accepted' as const,
    promoted_wiki_id: page.id,
    promoted_revision: page.revision,
    reviewed_at: reviewedAt,
    review_decisions: [
      ...draft.review_decisions,
      {
        at: reviewedAt,
        decision: 'promoted' as const,
        reason: 'Existing promoted wiki already represents the selected evidence.',
      },
    ],
  }));
}

export async function autoPromoteWikiDrafts(draftIds: string[]): Promise<KnowledgeWikiPage[]> {
  const existing = await listKnowledgeWikis();
  const reservedIds = new Set(existing.map((page) => page.id));
  const pages: KnowledgeWikiPage[] = [];

  for (const draftId of draftIds) {
    let draft = await readNodeByType('wiki-draft', draftId);
    if (draft.operation === 'needs-review') {
      draft = await prepareAmbiguousDraft(draft, reservedIds);
    }
    if (draft.operation === 'no-op') {
      const represented = [...existing, ...pages].find((page) =>
        draft.source_canonical_idea_ids.every((id) => page.source_canonical_idea_ids.includes(id)),
      );
      if (!represented) throw new Error('No promoted wiki represents this no-op draft.');
      await acceptRepresentedDraft(draft, represented);
      pages.push(represented);
      continue;
    }

    const promoted =
      draft.operation === 'create'
        ? await promoteCreateWikiDraft(draft, {
            decisionReason: 'Promoted automatically after source-backed generation.',
          })
        : await promoteUpdateWikiDraft(draft, {
            decisionReason: 'Update promoted automatically after source-backed generation.',
          });
    reservedIds.add(promoted.page.id);
    pages.push(promoted.page);
  }

  return pages.filter((page, index, all) => all.findIndex((item) => item.id === page.id) === index);
}
