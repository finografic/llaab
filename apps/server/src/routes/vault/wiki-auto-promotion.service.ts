import { getNodeFilePath, listKnowledgeWikis, readNodeByType, updateNode } from '@llaab/core';
import {
  DEFAULT_WIKI_AUTO_PROMOTION_QUALITY_THRESHOLD,
  evaluateWikiAutoPromotionPolicy,
  formatIsoUtcSeconds,
} from '@llaab/schemas';
import type { KnowledgeWikiPage, WikiDraftNode, WikiOneStepBranchOutcome } from '@llaab/schemas';

import { promoteCreateWikiDraft, promoteUpdateWikiDraft } from './wiki-promotion.service.js';

export interface AutoPromoteBranchResult {
  draftId: string;
  outcome: WikiOneStepBranchOutcome;
  wikiId?: string;
  wiki?: KnowledgeWikiPage;
  warnings: string[];
  reasons: string[];
}

export interface AutoPromoteWikiDraftsResult {
  pages: KnowledgeWikiPage[];
  branches: AutoPromoteBranchResult[];
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

function draftHasValidLinks(draft: WikiDraftNode): boolean {
  try {
    // Promotion validates against the live index; pre-check shape/notes only.
    for (const link of draft.proposed_links) {
      if (!link.note?.trim()) return false;
      if (link.target_wiki_id === draft.topic_key) return false;
    }
    return true;
  } catch {
    return false;
  }
}

function policyInputForDraft(draft: WikiDraftNode): Parameters<typeof evaluateWikiAutoPromotionPolicy>[0] {
  const coherenceFailed =
    draft.quality_dimensions != null
      ? draft.quality_dimensions.blocking_dimensions.includes('topic_coherence')
      : draft.validation_issues.some((issue) =>
          ['mechanical-idea-headings', 'source-shaped-title', 'over-fragmentation', 'over-collapse'].includes(
            issue.code,
          ),
        );
  const evidenceGatesPassed =
    draft.source_refs.length > 0 &&
    (draft.primary_canonical_idea_ids.length > 0 || draft.source_canonical_idea_ids.length > 0) &&
    (draft.evidence_metrics?.evidence_ref_count ?? draft.source_refs.length) > 0;

  return {
    operation: draft.operation,
    // Verification is recalculated from evidence groups — claim strings alone are not contested.
    verificationStatus: 'source-backed',
    qualityScore: draft.quality_dimensions?.overall_score ?? draft.quality_score ?? 0,
    qualityThreshold: DEFAULT_WIKI_AUTO_PROMOTION_QUALITY_THRESHOLD,
    coherencePassed: !coherenceFailed,
    evidenceGatesPassed,
    hasValidLinks: draftHasValidLinks(draft),
    hasValidSourceRefs: draft.source_refs.length > 0,
    baseRevisionMatches:
      draft.operation === 'update'
        ? draft.base_revision !== undefined && draft.base_content_hash !== undefined
        : undefined,
    inventedSuffixedTopicKey: false,
    sourceRefs: draft.source_refs,
    contestedClaimEvidence: draft.contested_claim_evidence,
    evidenceMetrics: draft.evidence_metrics,
    qualityDimensions: draft.quality_dimensions,
  };
}

/**
 * Auto-promote valid create/update drafts. Never invents suffixed topics for needs-review.
 */
export async function autoPromoteWikiDrafts(draftIds: string[]): Promise<AutoPromoteWikiDraftsResult> {
  const existing = await listKnowledgeWikis();
  const pages: KnowledgeWikiPage[] = [];
  const branches: AutoPromoteBranchResult[] = [];

  for (const draftId of draftIds) {
    const draft = await readNodeByType('wiki-draft', draftId);
    const policy = evaluateWikiAutoPromotionPolicy(policyInputForDraft(draft));

    if (!policy.allow) {
      branches.push({
        draftId,
        outcome: policy.outcome,
        warnings: draft.warning ? [draft.warning] : [],
        reasons: policy.reasons,
      });
      continue;
    }

    if (draft.operation === 'no-op') {
      const representedId = draft.target_wiki_id ?? draft.promoted_wiki_id;
      const represented =
        (representedId ? [...existing, ...pages].find((page) => page.id === representedId) : undefined) ??
        [...existing, ...pages].find(
          (page) =>
            page.topic_key === draft.topic_key &&
            draft.source_canonical_idea_ids.length > 0 &&
            draft.source_canonical_idea_ids.every((id) => page.source_canonical_idea_ids.includes(id)) &&
            page.source_canonical_idea_ids.length === draft.source_canonical_idea_ids.length,
        );
      if (!represented) {
        branches.push({
          draftId,
          outcome: 'failed',
          warnings: [],
          reasons: ['No exact existing wiki match for no-op draft.'],
        });
        continue;
      }
      await acceptRepresentedDraft(draft, represented);
      pages.push(represented);
      branches.push({
        draftId,
        outcome: 'existing-no-op',
        wikiId: represented.id,
        wiki: represented,
        warnings: [],
        reasons: policy.reasons,
      });
      continue;
    }

    try {
      const promoted =
        draft.operation === 'create'
          ? await promoteCreateWikiDraft(draft, {
              decisionReason: 'Promoted automatically after source-backed generation.',
            })
          : await promoteUpdateWikiDraft(draft, {
              decisionReason: 'Update promoted automatically after source-backed generation.',
            });
      pages.push(promoted.page);
      branches.push({
        draftId,
        outcome: draft.operation === 'create' ? 'promoted-create' : 'promoted-update',
        wikiId: promoted.page.id,
        wiki: promoted.page,
        warnings: draft.warning ? [draft.warning] : [],
        reasons: policy.reasons,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      branches.push({
        draftId,
        outcome: 'failed',
        warnings: [],
        reasons: [reason],
      });
    }
  }

  const uniquePages = pages.filter(
    (page, index, all) => all.findIndex((item) => item.id === page.id) === index,
  );

  return { pages: uniquePages, branches };
}
