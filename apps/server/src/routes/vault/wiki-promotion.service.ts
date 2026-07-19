import {
  assertValidKnowledgeWikiLinks,
  getKnowledgeWikiPath,
  determineKnowledgeWikiLifecycle,
  getNodeFilePath,
  hashKnowledgeWikiPage,
  listKnowledgeWikis,
  readKnowledgeWiki,
  updateNode,
  withKnowledgeWikiLock,
  writeKnowledgeWiki,
} from '@llaab/core';
import { formatIsoUtcSeconds } from '@llaab/schemas';
import type { KnowledgeWikiPage, WikiDraftNode } from '@llaab/schemas';

const SECTION_MARKER = /<!--\s*wiki-section:([a-z0-9]+(?:[-_][a-z0-9]+)*)\s*-->/g;

function verificationForDraft(
  draft: WikiDraftNode,
  current?: KnowledgeWikiPage,
): KnowledgeWikiPage['verification_status'] {
  if (draft.contested_claim_evidence.length > 0 || draft.contested_claims.length > 0) return 'contested';
  const hasValidatedExternal = draft.source_refs.some(
    (ref) =>
      ref.kind === 'external' && ref.verification === 'corroborated' && ref.validation_notes?.length === 0,
  );
  if (
    hasValidatedExternal ||
    draft.source_ids.length >= 2 ||
    current?.verification_status === 'corroborated'
  ) {
    return 'corroborated';
  }
  return 'source-backed';
}

function sectionsById(body: string): Map<string, string> {
  const matches = [...body.matchAll(SECTION_MARKER)];
  return new Map(
    matches.map((match, index) => [match[1]!, body.slice(match.index!, matches[index + 1]?.index).trim()]),
  );
}

function applyDraftSections(currentBody: string, draft: WikiDraftNode): string {
  const current = sectionsById(currentBody);
  const proposed = sectionsById(draft.body);
  if (proposed.size === 0) throw new Error('Update draft contains no stable sections.');
  const accepted =
    draft.patch.length === 0
      ? new Set(proposed.keys())
      : new Set(
          draft.patch
            .filter((patch) => patch.operation === 'add' || patch.operation === 'update')
            .map((patch) => patch.section_id),
        );
  const removed = new Set(
    draft.patch.filter((patch) => patch.operation === 'remove').map((patch) => patch.section_id),
  );
  const output: string[] = [];
  for (const [id, section] of current) {
    if (removed.has(id)) continue;
    output.push(accepted.has(id) && proposed.has(id) ? proposed.get(id)! : section);
    proposed.delete(id);
  }
  for (const id of accepted) {
    const section = proposed.get(id);
    if (section) output.push(section);
  }
  return output.join('\n\n');
}

function validateDraftLinks(draft: WikiDraftNode, pages: KnowledgeWikiPage[]): void {
  assertValidKnowledgeWikiLinks(
    draft.target_wiki_id ?? draft.topic_key,
    draft.proposed_links,
    pages.map((page) => page.id),
  );
}

function createPromotedPage(draft: WikiDraftNode, reviewedAt: string): KnowledgeWikiPage {
  const page: KnowledgeWikiPage = {
    id: draft.topic_key,
    type: 'wiki',
    topic_key: draft.topic_key,
    title: draft.title,
    aliases: [],
    summary: draft.change_summary ?? '',
    body: draft.body,
    status: 'seed',
    tags: draft.tags,
    links: draft.proposed_links,
    source_refs: draft.source_refs,
    source_canonical_idea_ids: draft.source_canonical_idea_ids,
    source_transcript_ids: draft.source_transcript_ids,
    revision: 1,
    created_at: reviewedAt,
    updated_at: reviewedAt,
    reviewed_at: reviewedAt,
    verification_status: verificationForDraft(draft),
    quality_score: draft.quality_score,
    generation_provider: draft.llm_provider,
    generation_model: draft.llm_model,
    generation_duration_ms: draft.llm_duration_ms,
  };
  return { ...page, status: determineKnowledgeWikiLifecycle(page) };
}

function isEquivalentPromotion(page: KnowledgeWikiPage, expected: KnowledgeWikiPage): boolean {
  return (
    page.id === expected.id &&
    page.topic_key === expected.topic_key &&
    page.title === expected.title &&
    page.summary === expected.summary &&
    page.body === expected.body &&
    page.revision === 1 &&
    page.status === expected.status &&
    page.verification_status === 'source-backed' &&
    JSON.stringify(page.tags) === JSON.stringify(expected.tags) &&
    JSON.stringify(page.links) === JSON.stringify(expected.links) &&
    JSON.stringify(page.source_refs) === JSON.stringify(expected.source_refs) &&
    JSON.stringify(page.source_canonical_idea_ids) === JSON.stringify(expected.source_canonical_idea_ids) &&
    JSON.stringify(page.source_transcript_ids) === JSON.stringify(expected.source_transcript_ids)
  );
}

export async function promoteCreateWikiDraft(
  draft: WikiDraftNode,
  options: { decisionReason?: string } = {},
): Promise<{
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
    validateDraftLinks(draft, existing);
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
      review_decisions: [
        ...draft.review_decisions,
        {
          at: result.page.reviewed_at ?? formatIsoUtcSeconds(new Date()),
          decision: 'promoted',
          reason: options.decisionReason ?? 'Promoted after explicit review.',
        },
      ],
    }));
  }

  return result;
}

export async function promoteUpdateWikiDraft(
  draft: WikiDraftNode,
  options: { decisionReason?: string } = {},
): Promise<{
  path: string;
  page: KnowledgeWikiPage;
}> {
  if (
    draft.operation !== 'update' ||
    !draft.target_wiki_id ||
    !draft.base_revision ||
    !draft.base_content_hash
  ) {
    throw new Error('Wiki draft is missing its update base revision or target.');
  }
  if (draft.draft_status === 'accepted') {
    if (draft.promoted_wiki_id !== draft.target_wiki_id || !draft.promoted_revision) {
      throw new Error('Accepted wiki draft has no matching promoted revision.');
    }
    const page = await readKnowledgeWiki(draft.target_wiki_id);
    if (page.revision !== draft.promoted_revision) {
      throw new Error('The promoted wiki changed after this draft was accepted.');
    }
    return { path: getKnowledgeWikiPath(page.id), page };
  }
  if (draft.draft_status !== 'proposed') throw new Error('Only proposed wiki drafts can be promoted.');

  const result = await withKnowledgeWikiLock(draft.target_wiki_id, async () => {
    const current = await readKnowledgeWiki(draft.target_wiki_id!);
    if (
      current.revision !== draft.base_revision ||
      hashKnowledgeWikiPage(current) !== draft.base_content_hash
    ) {
      throw new Error(
        'The promoted wiki changed after this draft was compiled. Regenerate before promotion.',
      );
    }
    const sourceRefs = [...current.source_refs, ...draft.source_refs].filter(
      (ref, index, all) => all.findIndex((item) => item.id === ref.id) === index,
    );
    const existing = await listKnowledgeWikis();
    validateDraftLinks(draft, existing);
    const next: KnowledgeWikiPage = {
      ...current,
      title: draft.title,
      summary: draft.change_summary ?? current.summary,
      body: applyDraftSections(current.body, draft),
      links: draft.proposed_links.length > 0 ? draft.proposed_links : current.links,
      source_refs: sourceRefs,
      source_canonical_idea_ids: [
        ...new Set([...current.source_canonical_idea_ids, ...draft.source_canonical_idea_ids]),
      ],
      source_transcript_ids: [...new Set([...current.source_transcript_ids, ...draft.source_transcript_ids])],
      verification_status: verificationForDraft(draft, current),
      tags: [...new Set([...current.tags, ...draft.tags])],
      quality_score: draft.quality_score,
      generation_provider: draft.llm_provider,
      generation_model: draft.llm_model,
      generation_duration_ms: draft.llm_duration_ms,
      revision: current.revision + 1,
      updated_at: formatIsoUtcSeconds(new Date()),
      reviewed_at: formatIsoUtcSeconds(new Date()),
    };
    return writeKnowledgeWiki({ ...next, status: determineKnowledgeWikiLifecycle(next) });
  });
  await updateNode(getNodeFilePath('wiki-draft', draft.id), () => ({
    ...draft,
    draft_status: 'accepted',
    promoted_wiki_id: result.page.id,
    promoted_revision: result.page.revision,
    reviewed_at: result.page.reviewed_at,
    review_decisions: [
      ...draft.review_decisions,
      {
        at: result.page.reviewed_at ?? formatIsoUtcSeconds(new Date()),
        decision: 'promoted',
        reason: options.decisionReason ?? 'Update promoted after revision validation.',
      },
    ],
  }));
  return result;
}
