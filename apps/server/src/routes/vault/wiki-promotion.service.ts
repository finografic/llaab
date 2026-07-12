import {
  getKnowledgeWikiPath,
  getNodeFilePath,
  listKnowledgeWikis,
  readKnowledgeWiki,
  updateNode,
  withKnowledgeWikiLock,
  writeKnowledgeWiki,
} from '@llaab/core';
import { formatIsoUtcSeconds } from '@llaab/schemas';
import type { KnowledgeWikiPage, WikiDraftNode } from '@llaab/schemas';

function createPromotedPage(draft: WikiDraftNode, reviewedAt: string): KnowledgeWikiPage {
  return {
    id: draft.topic_key,
    type: 'wiki',
    topic_key: draft.topic_key,
    title: draft.title,
    aliases: [],
    summary: draft.change_summary ?? '',
    body: draft.body,
    status: 'seed',
    tags: draft.tags.filter((tag) => tag.startsWith('d:')),
    links: [],
    source_refs: draft.source_refs,
    source_canonical_idea_ids: draft.source_canonical_idea_ids,
    source_transcript_ids: draft.source_transcript_ids,
    revision: 1,
    created_at: reviewedAt,
    updated_at: reviewedAt,
    reviewed_at: reviewedAt,
    verification_status: 'source-backed',
  };
}

function isEquivalentPromotion(page: KnowledgeWikiPage, expected: KnowledgeWikiPage): boolean {
  return (
    page.id === expected.id &&
    page.topic_key === expected.topic_key &&
    page.title === expected.title &&
    page.summary === expected.summary &&
    page.body === expected.body &&
    page.revision === 1 &&
    page.status === 'seed' &&
    page.verification_status === 'source-backed' &&
    JSON.stringify(page.tags) === JSON.stringify(expected.tags) &&
    JSON.stringify(page.links) === JSON.stringify(expected.links) &&
    JSON.stringify(page.source_refs) === JSON.stringify(expected.source_refs) &&
    JSON.stringify(page.source_canonical_idea_ids) === JSON.stringify(expected.source_canonical_idea_ids) &&
    JSON.stringify(page.source_transcript_ids) === JSON.stringify(expected.source_transcript_ids)
  );
}

export async function promoteCreateWikiDraft(draft: WikiDraftNode): Promise<{
  path: string;
  page: KnowledgeWikiPage;
  recovered: boolean;
}> {
  if (draft.operation !== 'create') throw new Error('Only create drafts can be promoted in Phase 2.');
  if (draft.draft_status !== 'proposed' && draft.draft_status !== 'accepted') {
    throw new Error('Only proposed wiki drafts can be promoted.');
  }

  const result = await withKnowledgeWikiLock(draft.topic_key, async () => {
    const expected = createPromotedPage(draft, formatIsoUtcSeconds(new Date()));
    const existing = await listKnowledgeWikis();
    const sameId = existing.find((page) => page.id === expected.id);
    const sameTopic = existing.find((page) => page.topic_key === expected.topic_key);

    if (sameId || sameTopic) {
      const page = await readKnowledgeWiki((sameId ?? sameTopic)!.id);
      if (!isEquivalentPromotion(page, expected)) {
        throw new Error('A different promoted wiki already represents this topic.');
      }
      return { path: getKnowledgeWikiPath(page.id), page, recovered: true };
    }

    const written = await writeKnowledgeWiki(expected);
    return { ...written, recovered: false };
  });

  if (draft.draft_status !== 'accepted' || draft.promoted_wiki_id !== result.page.id) {
    await updateNode(getNodeFilePath('wiki-draft', draft.id), () => ({
      ...draft,
      draft_status: 'accepted',
      promoted_wiki_id: result.page.id,
      promoted_revision: result.page.revision,
      reviewed_at: result.page.reviewed_at,
    }));
  }

  return result;
}
