import {
  assertValidKnowledgeWikiLinks,
  getKnowledgeWikiSectionIds,
  getNodeFilePath,
  listKnowledgeWikis,
  listNodes,
  readKnowledgeWiki,
  updateNode,
} from '@llaab/core';
import { formatIsoUtcSeconds } from '@llaab/schemas';
import { buildWikiResultingBody, compileWikiDraft } from '@llaab/skills';
import type {
  EditWikiDraftBody,
  ListWikiDraftsQuery,
  ResolveWikiDraftBody,
} from './vault-wiki-drafts.schema.js';
import type { WikiDraftNode, WikiSectionDraft, WikiSectionPatch } from '@llaab/schemas';

const MAX_WIKI_DRAFT_BODY_CHARS = 80_000;

function renderSections(sections: WikiSectionDraft[]): string {
  const body = sections
    .map((section) => {
      const citations = section.source_ref_ids.map((sourceRefId) => `[^${sourceRefId}]`).join(' ');
      return `<!-- wiki-section:${section.id} -->\n\n## ${section.heading}\n\n${section.body}${citations ? ` ${citations}` : ''}`;
    })
    .join('\n\n');
  if (body.length > MAX_WIKI_DRAFT_BODY_CHARS) {
    throw new Error(`Edited wiki draft exceeds ${MAX_WIKI_DRAFT_BODY_CHARS} character limit.`);
  }
  return body;
}

function validateEditedSections(draft: WikiDraftNode, sections: WikiSectionDraft[]): void {
  const knownSourceRefIds = new Set(draft.source_refs.map((sourceRef) => sourceRef.id));
  const sectionIds = new Set<string>();
  for (const section of sections) {
    if (sectionIds.has(section.id)) throw new Error(`Duplicate edited section id: ${section.id}`);
    sectionIds.add(section.id);
    if (section.body.trim() && section.source_ref_ids.length === 0) {
      throw new Error(`Edited section "${section.id}" has no source reference.`);
    }
    for (const id of section.source_ref_ids) {
      if (!knownSourceRefIds.has(id)) throw new Error(`Edited section references unknown source ref: ${id}`);
    }
  }
}

async function validateProposedLinks(draft: WikiDraftNode): Promise<void> {
  const promotedIds = (await listKnowledgeWikis()).map((wiki) => wiki.id);
  assertValidKnowledgeWikiLinks(draft.target_wiki_id ?? draft.topic_key, draft.proposed_links, promotedIds);
}

async function buildEditedPatch(
  draft: WikiDraftNode,
  sections: WikiSectionDraft[],
): Promise<WikiSectionPatch[]> {
  if (!draft.target_wiki_id) return [];
  const current = await readKnowledgeWiki(draft.target_wiki_id);
  const currentIds = new Set(getKnowledgeWikiSectionIds(current.body));
  const editedIds = new Set(sections.map((section) => section.id));
  return [
    ...sections.map((section) => ({
      section_id: section.id,
      operation: currentIds.has(section.id) ? ('update' as const) : ('add' as const),
      after: section.body,
    })),
    ...[...currentIds]
      .filter((id) => !editedIds.has(id))
      .map((id) => ({ section_id: id, operation: 'unchanged' as const })),
  ];
}

export async function applyWikiDraftEdit(
  draft: WikiDraftNode,
  edit: EditWikiDraftBody,
): Promise<WikiDraftNode> {
  if (draft.draft_status !== 'proposed') throw new Error('Only proposed wiki drafts can be edited.');
  const sections = edit.sections ?? draft.sections;
  validateEditedSections(draft, sections);
  await validateProposedLinks(draft);
  const body = edit.sections ? renderSections(sections) : draft.body;
  const patch = edit.sections ? await buildEditedPatch(draft, sections) : draft.patch;
  const currentBody = draft.target_wiki_id ? (await readKnowledgeWiki(draft.target_wiki_id)).body : undefined;
  const resultingBody = buildWikiResultingBody(currentBody, body, patch);
  const validationIssues = draft.validation_issues.filter(
    (issue) => !['human-edit', 'edited-section-validation'].includes(issue.code),
  );
  validationIssues.push({ code: 'human-edit', message: 'Draft contains explicit reviewer edits.' });

  const result = await updateNode(getNodeFilePath('wiki-draft', draft.id), () => ({
    ...draft,
    ...(edit.title ? { title: edit.title } : {}),
    ...(edit.summary ? { change_summary: edit.summary } : {}),
    sections,
    body,
    patch,
    resulting_body: resultingBody,
    unchanged_section_ids: patch
      .filter((item) => item.operation === 'unchanged')
      .map((item) => item.section_id),
    validation_issues: validationIssues,
    quality_score: Math.max(0, (draft.quality_score ?? 100) - 5),
    reviewer_edits: true,
  }));
  if (result.node.type !== 'wiki-draft') throw new Error('Edited node is not a wiki draft.');
  return result.node;
}

export async function listWikiDraftNodes(query: ListWikiDraftsQuery) {
  const drafts = (await listNodes({ type: 'wiki-draft' }))
    .filter((node): node is WikiDraftNode => node.type === 'wiki-draft')
    .filter((draft) => (query.status ? draft.draft_status === query.status : true))
    .filter((draft) => (query.topic ? draft.topic_key.includes(query.topic) : true))
    .filter((draft) => (query.target ? draft.target_wiki_id === query.target : true));
  return { drafts: drafts.slice(query.offset, query.offset + query.limit), total: drafts.length };
}

export async function rejectWikiDraftReview(draft: WikiDraftNode): Promise<WikiDraftNode> {
  if (draft.draft_status !== 'proposed') throw new Error('Only proposed wiki drafts can be rejected.');
  const reviewedAt = formatIsoUtcSeconds(new Date());
  const result = await updateNode(getNodeFilePath('wiki-draft', draft.id), () => ({
    ...draft,
    draft_status: 'rejected',
    reviewed_at: reviewedAt,
    review_decisions: [
      ...draft.review_decisions,
      { at: reviewedAt, decision: 'rejected' as const, reason: 'Rejected by explicit review action.' },
    ],
  }));
  if (result.node.type !== 'wiki-draft') throw new Error('Rejected node is not a wiki draft.');
  return result.node;
}

function requireDraftLineage(draft: WikiDraftNode): string {
  const transcriptId = draft.source_transcript_ids[0];
  if (!transcriptId || draft.source_canonical_idea_ids.length === 0) {
    throw new Error('Wiki draft does not retain enough lineage to regenerate.');
  }
  return transcriptId;
}

async function supersedeWikiDraft(draft: WikiDraftNode): Promise<void> {
  await updateNode(getNodeFilePath('wiki-draft', draft.id), () => ({
    ...draft,
    draft_status: 'superseded',
    reviewed_at: formatIsoUtcSeconds(new Date()),
  }));
}

export async function regenerateWikiDraftReview(draft: WikiDraftNode) {
  const transcriptId = requireDraftLineage(draft);
  const compiled = await compileWikiDraft({
    transcriptId,
    canonicalIdeaIds: draft.source_canonical_idea_ids,
    suggestedTitle: draft.title,
    suggestedTopicKey: draft.topic_key,
    targetWikiId: draft.target_wiki_id,
    entryPath: draft.entry_path,
  });
  if (compiled.record.status === 'failed') {
    throw new Error(compiled.record.error ?? 'Wiki regeneration failed.');
  }
  await supersedeWikiDraft(draft);
  return { runId: compiled.record.runNodeId, draftId: compiled.result.draftId };
}

export async function resolveWikiDraftTopic(draft: WikiDraftNode, body: ResolveWikiDraftBody) {
  if (draft.draft_status !== 'proposed' || draft.operation !== 'needs-review') {
    throw new Error('Only proposed ambiguous wiki drafts can resolve a topic.');
  }
  if (body.distinct_topic_key) {
    const result = await updateNode(getNodeFilePath('wiki-draft', draft.id), () => ({
      ...draft,
      operation: 'create',
      topic_key: body.distinct_topic_key ?? draft.topic_key,
      topic_matches: [],
      warning: 'Reviewer confirmed this is a distinct topic.',
      reviewer_edits: true,
    }));
    return { draft: result.node };
  }
  const targetWikiId = body.target_wiki_id;
  if (!targetWikiId || !draft.topic_matches.some((match) => match.wiki_id === targetWikiId)) {
    throw new Error('Select one of the recorded topic-match targets.');
  }
  const transcriptId = requireDraftLineage(draft);
  const compiled = await compileWikiDraft({
    transcriptId,
    canonicalIdeaIds: draft.source_canonical_idea_ids,
    suggestedTitle: draft.title,
    targetWikiId,
    entryPath: draft.entry_path,
  });
  if (compiled.record.status === 'failed') {
    throw new Error(compiled.record.error ?? 'Wiki target resolution failed.');
  }
  await supersedeWikiDraft(draft);
  return { runId: compiled.record.runNodeId, draftId: compiled.result.draftId };
}
