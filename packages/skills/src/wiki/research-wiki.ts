import { createHash } from 'node:crypto';
import {
  createNode,
  getKnowledgeWikiSectionIds,
  getNodeFilePath,
  hashKnowledgeWikiPage,
  readKnowledgeWiki,
  readNodeByType,
  updateNode,
} from '@llaab/core';
import { formatIsoUtcSeconds, WikiResearchRequestSchema } from '@llaab/schemas';
import type { WikiDraftNode, WikiResearchRequest, WikiSourceRef } from '@llaab/schemas';

import { runSkill } from '../runner.js';

function sourceRefId(url: string, excerpt: string): string {
  return `external-${createHash('sha256').update(`${url}\n${excerpt}`).digest('hex').slice(0, 16)}`;
}

function researchSourceRefs(request: WikiResearchRequest, retrievedAt: string): WikiSourceRef[] {
  return request.results.map((result) => {
    const validationNotes = [
      ...(!result.authoritative ? ['Source was not marked authoritative.'] : []),
      ...result.validation_notes,
    ];
    return {
      id: sourceRefId(result.url, result.excerpt),
      kind: 'external',
      title: result.title,
      url: result.url,
      verification: result.contradicts_claim
        ? 'contested'
        : result.authoritative && validationNotes.length === 0
          ? 'corroborated'
          : 'source-backed',
      retrieval_query: request.query,
      retrieval_provider: request.provider,
      retrieved_at: retrievedAt,
      excerpt: result.excerpt,
      validation_notes: validationNotes,
    };
  });
}

function appendUniqueSourceRefs(sourceRefs: WikiSourceRef[], incoming: WikiSourceRef[]): WikiSourceRef[] {
  return [...sourceRefs, ...incoming].filter(
    (sourceRef, index, all) => all.findIndex((candidate) => candidate.id === sourceRef.id) === index,
  );
}

function contestedEvidence(request: WikiResearchRequest, refs: WikiSourceRef[]) {
  return request.results
    .map((result, index) => {
      if (!result.contradicts_claim) return undefined;
      return {
        claim: result.contradicts_claim,
        existing_source_ref_ids: [],
        incoming_source_ref_ids: [refs[index]!.id],
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== undefined);
}

async function updateDraftWithResearch(
  draft: WikiDraftNode,
  request: WikiResearchRequest,
  refs: WikiSourceRef[],
) {
  const contested = contestedEvidence(request, refs);
  const issues = refs
    .filter((ref) => ref.verification !== 'corroborated')
    .map((ref) => ({
      code: ref.verification === 'contested' ? 'external-contradiction' : 'external-source-quality',
      message: `External source requires review: ${ref.title ?? ref.id}`,
    }));
  const result = await updateNode(getNodeFilePath('wiki-draft', draft.id), () => ({
    ...draft,
    source_refs: appendUniqueSourceRefs(draft.source_refs, refs),
    validation_issues: [...draft.validation_issues, ...issues],
    contested_claims: [...new Set([...draft.contested_claims, ...contested.map((item) => item.claim)])],
    contested_claim_evidence: [...draft.contested_claim_evidence, ...contested],
    change_summary: [draft.change_summary, `External research reviewed for: ${request.query}`]
      .filter(Boolean)
      .join(' '),
  }));
  if (result.node.type !== 'wiki-draft') throw new Error('Updated research target is not a wiki draft.');
  return result.node;
}

async function createResearchDraft(request: WikiResearchRequest, refs: WikiSourceRef[]) {
  const wiki = await readKnowledgeWiki(request.wiki_id!);
  const contested = contestedEvidence(request, refs).map((item) => ({
    ...item,
    existing_source_ref_ids: wiki.source_refs.map((ref) => ref.id),
  }));
  const hasReviewBlocker = refs.some((ref) => ref.verification !== 'corroborated');
  const operation = hasReviewBlocker ? 'needs-review' : 'update';
  const created = await createNode({
    type: 'wiki-draft',
    title: `${wiki.title} research`,
    body: wiki.body,
    tags: wiki.tags,
    extra: {
      topic_key: wiki.topic_key,
      target_wiki_id: wiki.id,
      operation,
      entry_path: 'manual',
      source_canonical_idea_ids: wiki.source_canonical_idea_ids,
      source_transcript_ids: wiki.source_transcript_ids,
      source_refs: appendUniqueSourceRefs(wiki.source_refs, refs),
      base_revision: wiki.revision,
      base_content_hash: hashKnowledgeWikiPage(wiki),
      patch: getKnowledgeWikiSectionIds(wiki.body).map((sectionId) => ({
        section_id: sectionId,
        operation: 'unchanged',
      })),
      resulting_body: wiki.body,
      unchanged_section_ids: getKnowledgeWikiSectionIds(wiki.body),
      quality_score: hasReviewBlocker ? 60 : 90,
      validation_issues: refs
        .filter((ref) => ref.verification !== 'corroborated')
        .map((ref) => ({
          code: ref.verification === 'contested' ? 'external-contradiction' : 'external-source-quality',
          message: `External source requires review: ${ref.title ?? ref.id}`,
        })),
      change_summary: `External research reviewed for: ${request.query}`,
      contested_claims: contested.map((item) => item.claim),
      contested_claim_evidence: contested,
    },
  });
  return created.id;
}

/**
 * Explicit research boundary. Retrieval adapters are intentionally not implicit: this one-shot run
 * records the approved request and leaves evidence review to a subsequent wiki draft workflow.
 */
export async function researchWiki(request: WikiResearchRequest) {
  const approved = WikiResearchRequestSchema.parse(request);
  const retrievedAt = formatIsoUtcSeconds(new Date());
  const refs = researchSourceRefs(approved, retrievedAt);
  return runSkill(
    'research-wiki',
    async () => {
      const draftId =
        refs.length === 0
          ? undefined
          : approved.draft_id
            ? (
                await updateDraftWithResearch(
                  await readNodeByType('wiki-draft', approved.draft_id),
                  approved,
                  refs,
                )
              ).id
            : await createResearchDraft(approved, refs);
      return {
        targetId: approved.wiki_id ?? approved.draft_id!,
        query: approved.query,
        provider: approved.provider,
        maxResults: approved.max_results,
        ...(draftId ? { draftId } : {}),
        sourceRefs: refs,
        producedNodeIds: draftId ? [draftId] : [],
        runTrace: {
          stages: [
            { name: 'approve-research', status: 'completed', output: { provider: approved.provider } },
            { name: 'validate-results', status: 'completed', output: { resultCount: refs.length } },
            { name: 'write-review-draft', status: 'completed', output: { draftId } },
          ],
          decisions: [
            {
              type: refs.some(
                (ref) => ref.verification === 'contested' || ref.verification !== 'corroborated',
              )
                ? 'downgrade'
                : 'accept',
              reason:
                refs.length === 0
                  ? 'Research request approved; no retrieval results were supplied.'
                  : 'Research evidence was persisted for explicit wiki review.',
            },
          ],
        },
      };
    },
    approved,
  );
}
