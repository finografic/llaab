import {
  getNodeFilePath,
  listKnowledgeWikis,
  readKnowledgeWiki,
  readNodeByType,
  updateNode,
} from '@llaab/core';
import { assertNoForbiddenDraftPromotionUx, isWikiOneStepOverallSuccess } from '@llaab/schemas';
import { appendRunEvent, linkWikiTopics, runSkill } from '@llaab/skills';
import type { CreateWikiDraftBody } from './vault-wiki-drafts.schema.js';
import type { KnowledgeWikiPage, WikiLink, WikiOneStepBranchResult } from '@llaab/schemas';

import { autoPromoteWikiDrafts } from './wiki-auto-promotion.service.js';
import { executeTranscriptWikiCompile } from './wiki-draft-generation.service.js';

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
 * One-step Create Wiki(s): discover → compile → link → auto-promote under one parent RunNode.
 * Drafts remain audit artifacts; users are never asked to promote.
 */
export async function createTranscriptWikis(input: {
  transcriptId: string;
  body: CreateWikiDraftBody;
}): Promise<CreateTranscriptWikisResult> {
  const { record, result } = await runSkill(
    'compile-transcript-wikis',
    async (_, parentRunId) => {
      const compilation = await executeTranscriptWikiCompile(input, parentRunId);
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
        ({ result: compiled }) => compiled && !compiled.coherenceFailed && compiled.draftId,
      );

      for (const { result: compiled, record: childRecord } of compilation.compiled) {
        if (!compiled) continue;
        if (compiled.coherenceFailed) {
          branches.push({
            outcome: 'failed',
            draft_id: compiled.draftId,
            run_id: childRecord.runNodeId,
            reason: 'Topic coherence gate failed; draft retained for audit only.',
            warnings: compiled.warnings,
          });
          warnings.push(...compiled.warnings);
        }
      }

      await appendRunEvent(parentRunId, {
        level: 'info',
        message: `Linking ${promoteable.length} compiled topic(s).`,
      });

      const existingWikis = await listKnowledgeWikis();
      const linkCandidates = await Promise.all(
        promoteable.map(async ({ result: compiled }) => {
          const draft = await readNodeByType('wiki-draft', compiled.draftId);
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

      await appendRunEvent(parentRunId, {
        level: 'info',
        message: `Auto-promoting ${promoteable.length} draft(s).`,
      });

      const promotion = await autoPromoteWikiDrafts(
        promoteable.map(({ result: compiled }) => compiled.draftId),
      );
      for (const branch of promotion.branches) {
        const compiled = promoteable.find(({ result: item }) => item.draftId === branch.draftId);
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

      const draftIds = compilation.compiled.flatMap(({ result: compiled }) =>
        compiled?.draftId ? [compiled.draftId] : [],
      );
      const runIds = [parentRunId, ...compilation.compiled.map(({ record: child }) => child.runNodeId)];
      const qualityScore =
        promoteable.length > 0
          ? Math.min(...promoteable.map(({ result: compiled }) => compiled.qualityScore))
          : branches.some((branch) => branch.outcome === 'existing-no-op')
            ? 100
            : 0;

      const success = isWikiOneStepOverallSuccess(branches);
      assertNoForbiddenDraftPromotionUx(warnings);

      return {
        success,
        runId: parentRunId,
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
        producedNodeIds: draftIds,
        runTrace: {
          stages: [
            {
              name: 'discover',
              status: 'completed' as const,
              output: { discoveryBatchId: compilation.discoveryBatchId },
            },
            {
              name: 'compile',
              status: 'completed' as const,
              output: { compiled: compilation.compiled.length, branches: compilation.branches.length },
            },
            {
              name: 'link',
              status: 'completed' as const,
              output: { warnings: linkResult.warnings.length },
            },
            {
              name: 'auto-promote',
              status: success ? ('completed' as const) : ('failed' as const),
              output: {
                promoted: branches.filter((branch) => branch.outcome.startsWith('promoted')).length,
                wikiCount: wikis.length,
              },
            },
          ],
          decisions: [
            {
              type: success ? ('accept' as const) : ('reject' as const),
              reason: success
                ? 'One-step wiki creation produced at least one promoted or existing match.'
                : 'One-step wiki creation produced no successful branches.',
            },
          ],
        },
      };
    },
    {
      transcriptId: input.transcriptId,
      canonicalIdeaIds: input.body.canonical_idea_ids,
      suggestedTitle: input.body.suggested_title,
      suggestedTopicKey: input.body.suggested_topic_key,
      targetWikiId: input.body.target_wiki_id,
    },
  );

  if (record.status === 'failed' || !result) {
    throw new Error(record.error ?? 'Transcript wiki creation failed.');
  }

  return {
    success: result.success,
    runId: result.runId,
    runIds: result.runIds,
    branches: result.branches,
    wikis: result.wikis,
    wikiId: result.wikiId,
    wikiIds: result.wikiIds,
    wikiCount: result.wikiCount,
    draftIds: result.draftIds,
    draftCount: result.draftCount,
    draftId: result.draftId,
    warnings: result.warnings,
    qualityScore: result.qualityScore,
    linkWarnings: result.linkWarnings,
  };
}
