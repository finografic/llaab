import {
  getNodeFilePath,
  listKnowledgeWikis,
  readKnowledgeWiki,
  readNodeByType,
  updateNode,
} from '@llaab/core';
import { assertNoForbiddenDraftPromotionUx, isWikiOneStepOverallSuccess } from '@llaab/schemas';
import { linkWikiTopics } from '@llaab/skills';
import type { CreateWikiDraftBody } from './vault-wiki-drafts.schema.js';
import type { KnowledgeWikiPage, WikiLink, WikiOneStepBranchResult } from '@llaab/schemas';

import { autoPromoteWikiDrafts } from './wiki-auto-promotion.service.js';
import { compileWikiDraftsForTranscript } from './wiki-draft-generation.service.js';

export interface CreateTranscriptWikisResult {
  success: boolean;
  runId: string;
  runIds: string[];
  branches: WikiOneStepBranchResult[];
  wikis: KnowledgeWikiPage[];
  wikiId?: string;
  wikiIds: string[];
  wikiCount: number;
  draftIds: string[];
  draftCount: number;
  draftId?: string;
  warnings: string[];
  qualityScore: number;
  linkWarnings: string[];
}

async function applyLinksToDraft(draftId: string, links: WikiLink[]): Promise<void> {
  if (links.length === 0) return;
  const draft = await readNodeByType('wiki-draft', draftId);
  await updateNode(getNodeFilePath('wiki-draft', draftId), () => ({
    ...draft,
    proposed_links: links,
  }));
}

/**
 * One-step Create Wiki(s): discover → compile → link → auto-promote.
 * Drafts remain audit artifacts; users are never asked to promote.
 */
export async function createTranscriptWikis(input: {
  transcriptId: string;
  body: CreateWikiDraftBody;
}): Promise<CreateTranscriptWikisResult> {
  const compilation = await compileWikiDraftsForTranscript(input);
  const warnings: string[] = [];
  const branches: WikiOneStepBranchResult[] = [];

  for (const branch of compilation.branches) {
    if (branch.kind === 'skipped') {
      branches.push({
        outcome: 'skipped',
        proposal_id: branch.proposalId,
        reason: branch.reason,
        warnings: [],
      });
      continue;
    }
    if (branch.kind === 'failed') {
      branches.push({
        outcome: 'failed',
        proposal_id: branch.proposalId,
        run_id: branch.runId,
        reason: branch.reason,
        warnings: [],
      });
      continue;
    }
    if (branch.kind === 'no-op') {
      try {
        const wiki = await readKnowledgeWiki(branch.existingWikiId);
        branches.push({
          outcome: 'existing-no-op',
          proposal_id: branch.proposalId,
          wiki_id: wiki.id,
          reason: branch.reason,
          warnings: [],
        });
      } catch {
        branches.push({
          outcome: 'failed',
          proposal_id: branch.proposalId,
          reason: `no-op target missing: ${branch.existingWikiId}`,
          warnings: [],
        });
      }
    }
  }

  const promoteable = compilation.compiled.filter(
    ({ result }) => result && !result.coherenceFailed && result.draftId,
  );

  for (const { result, record } of compilation.compiled) {
    if (!result) continue;
    if (result.coherenceFailed) {
      branches.push({
        outcome: 'failed',
        draft_id: result.draftId,
        run_id: record.runNodeId,
        reason: 'Topic coherence gate failed; draft retained for audit only.',
        warnings: result.warnings,
      });
      warnings.push(...result.warnings);
    }
  }

  const existingWikis = await listKnowledgeWikis();
  const linkCandidates = await Promise.all(
    promoteable.map(async ({ result }) => {
      const draft = await readNodeByType('wiki-draft', result.draftId);
      return {
        temporaryKey: draft.topic_key,
        finalWikiId: draft.operation === 'update' ? draft.target_wiki_id : draft.topic_key,
        title: draft.title,
        summary: draft.change_summary ?? draft.title,
        tags: draft.tags,
        operation: draft.operation === 'update' ? ('update' as const) : ('create' as const),
        draftId: draft.id,
      };
    }),
  );

  const linkResult = await linkWikiTopics({
    candidates: linkCandidates.map(({ draftId: _draftId, ...candidate }) => candidate),
    existingWikis: existingWikis.map((wiki) => ({
      id: wiki.id,
      title: wiki.title,
      summary: wiki.summary,
      tags: wiki.tags,
    })),
  });
  warnings.push(...linkResult.warnings);

  for (const candidate of linkCandidates) {
    const links = linkResult.linksBySourceKey.get(candidate.temporaryKey) ?? [];
    await applyLinksToDraft(candidate.draftId, links);
  }

  const promotion = await autoPromoteWikiDrafts(promoteable.map(({ result }) => result.draftId));
  for (const branch of promotion.branches) {
    const compiled = promoteable.find(({ result }) => result.draftId === branch.draftId);
    branches.push({
      outcome: branch.outcome,
      draft_id: branch.draftId,
      wiki_id: branch.wikiId,
      run_id: compiled?.record.runNodeId,
      warnings: branch.warnings,
      reason: branch.reasons[0],
    });
    warnings.push(...branch.warnings);
  }

  // Collect resulting wiki pages: promoted + no-op existing.
  const wikis: KnowledgeWikiPage[] = [...promotion.pages];
  for (const branch of branches) {
    if (branch.outcome !== 'existing-no-op' || !branch.wiki_id) continue;
    if (wikis.some((wiki) => wiki.id === branch.wiki_id)) continue;
    try {
      wikis.push(await readKnowledgeWiki(branch.wiki_id));
    } catch {
      warnings.push(`Missing no-op wiki ${branch.wiki_id}`);
    }
  }

  const draftIds = compilation.compiled.flatMap(({ result }) => (result?.draftId ? [result.draftId] : []));
  const runIds = [compilation.parentRunId, ...compilation.compiled.map(({ record }) => record.runNodeId)];
  const qualityScore =
    promoteable.length > 0
      ? Math.min(...promoteable.map(({ result }) => result.qualityScore))
      : branches.some((branch) => branch.outcome === 'existing-no-op')
        ? 100
        : 0;

  const success = isWikiOneStepOverallSuccess(branches);
  assertNoForbiddenDraftPromotionUx(warnings);

  return {
    success,
    runId: compilation.parentRunId,
    runIds,
    branches,
    wikis,
    wikiId: wikis[0]?.id,
    wikiIds: wikis.map((wiki) => wiki.id),
    wikiCount: wikis.length,
    draftIds,
    draftCount: draftIds.length,
    draftId: draftIds[0],
    warnings,
    qualityScore,
    linkWarnings: linkResult.warnings,
  };
}
