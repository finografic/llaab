import {
  determineKnowledgeWikiLifecycle,
  getKnowledgeWikiSectionIds,
  listNodes,
  readKnowledgeWiki,
  readNodeByType,
  withKnowledgeWikiLock,
  writeKnowledgeWiki,
} from '@llaab/core';
import { formatIsoUtcSeconds } from '@llaab/schemas';
import { compileWikiDraft } from '@llaab/skills';
import type { KnowledgeWikiPage, WikiDraftNode, WikiSectionDraft } from '@llaab/schemas';

import { applyWikiDraftEdit } from '../vault/wiki-draft-review.service.js';
import { promoteUpdateWikiDraft } from '../vault/wiki-promotion.service.js';

const SECTION_MARKER = /<!--\s*wiki-section:([a-z0-9]+(?:[-_][a-z0-9]+)*)\s*-->/g;

function removeSection(body: string, sectionId: string): string {
  const matches = [...body.matchAll(SECTION_MARKER)];
  const index = matches.findIndex((match) => match[1] === sectionId);
  if (index < 0) throw new Error('Wiki section not found.');
  if (matches.length <= 1) throw new Error('A wiki must retain at least one sourced section.');
  return `${body.slice(0, matches[index]!.index)}${body.slice(matches[index + 1]?.index ?? body.length)}`.trim();
}

export async function deleteKnowledgeWikiSection(
  wikiId: string,
  sectionId: string,
): Promise<KnowledgeWikiPage> {
  return withKnowledgeWikiLock(wikiId, async () => {
    const current = await readKnowledgeWiki(wikiId);
    const now = formatIsoUtcSeconds(new Date());
    const next: KnowledgeWikiPage = {
      ...current,
      body: removeSection(current.body, sectionId),
      revision: current.revision + 1,
      updated_at: now,
      reviewed_at: now,
    };
    return (await writeKnowledgeWiki({ ...next, status: determineKnowledgeWikiLifecycle(next) })).page;
  });
}

async function findAcceptedSourceDraft(wikiId: string, sectionId: string): Promise<WikiDraftNode> {
  const drafts = (await listNodes({ type: 'wiki-draft' }))
    .filter((node): node is WikiDraftNode => node.type === 'wiki-draft')
    .filter((draft) => draft.draft_status === 'accepted' && draft.promoted_wiki_id === wikiId)
    .sort((left, right) => (right.reviewed_at ?? '').localeCompare(left.reviewed_at ?? ''));
  const draft =
    drafts.find((candidate) => candidate.sections.some((section) => section.id === sectionId)) ?? drafts[0];
  if (!draft) throw new Error('No accepted source draft was found for this wiki.');
  return draft;
}

export async function regenerateKnowledgeWikiSection(
  wikiId: string,
  sectionId: string,
): Promise<{ page: KnowledgeWikiPage; runId: string }> {
  const current = await readKnowledgeWiki(wikiId);
  if (!getKnowledgeWikiSectionIds(current.body).includes(sectionId)) {
    throw new Error('Wiki section not found.');
  }
  const sourceDraft = await findAcceptedSourceDraft(wikiId, sectionId);
  const sourceSection = sourceDraft.sections.find((section) => section.id === sectionId);
  const canonicalIdeaIds = sourceSection?.source_canonical_idea_ids.length
    ? sourceSection.source_canonical_idea_ids
    : sourceDraft.source_canonical_idea_ids;
  const transcriptId = sourceDraft.source_transcript_ids[0];
  if (!transcriptId || canonicalIdeaIds.length === 0) {
    throw new Error('This section does not retain enough source lineage to regenerate.');
  }

  const compiled = await compileWikiDraft({
    transcriptId,
    canonicalIdeaIds,
    suggestedTitle: current.title,
    targetWikiId: current.id,
    entryPath: 'manual',
    forceUpdate: true,
  });
  if (compiled.record.status === 'failed') {
    throw new Error(compiled.record.error ?? 'Section regeneration failed.');
  }
  const generated = await readNodeByType('wiki-draft', compiled.result.draftId);
  const candidate = generated.sections.find((section) => section.id === sectionId) ?? generated.sections[0];
  if (!candidate) {
    throw new Error('Section regeneration returned no sourced section.');
  }
  const replacement: WikiSectionDraft = { ...candidate, id: sectionId };
  const edited = await applyWikiDraftEdit(generated, { sections: [replacement] });
  const promoted = await promoteUpdateWikiDraft(edited, {
    decisionReason: `Section ${sectionId} regenerated and promoted automatically.`,
  });
  return { page: promoted.page, runId: compiled.record.runNodeId };
}
