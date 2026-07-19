import { z } from 'zod';
import type { WikiEvidenceMetrics } from './wiki-evidence-metrics.js';
import type { WikiQualityReport } from './wiki-quality-dimensions.js';
import type {
  WikiContestedClaimEvidence,
  WikiOperation,
  WikiSourceRef,
  WikiVerificationStatus,
} from './wiki.schema.js';

import { KnowledgeWikiPageSchema } from './knowledge/wiki-page.schema.js';
import { NodeIdSchema } from './primitives.schema.js';
import { determineWikiVerificationStatus } from './wiki-verification.js';
import { WikiValidationIssueSchema } from './wiki.schema.js';

/** Public one-step transcript operation (refined contract). */
export const CreateTranscriptWikisRequestSchema = z.object({
  canonical_idea_ids: z.array(NodeIdSchema).min(1),
});

export const WikiOneStepBranchOutcomeSchema = z.enum([
  'promoted-create',
  'promoted-update',
  'existing-no-op',
  'skipped',
  'failed',
]);

/** Internal pipeline stages — may appear in RunNode events, never as user decisions. */
export const WIKI_ONE_STEP_INTERNAL_STAGES = [
  'discover',
  'validate-proposals',
  'compile',
  'link',
  'auto-promote',
] as const;

export const WikiOneStepInternalStageSchema = z.enum(WIKI_ONE_STEP_INTERNAL_STAGES);

export const WikiOneStepBranchResultSchema = z.object({
  outcome: WikiOneStepBranchOutcomeSchema,
  proposal_id: NodeIdSchema.optional(),
  draft_id: NodeIdSchema.optional(),
  wiki_id: NodeIdSchema.optional(),
  run_id: NodeIdSchema.optional(),
  warnings: z.array(z.string()).default([]),
  reason: z.string().min(1).optional(),
});

export const CreateTranscriptWikisResponseSchema = z.object({
  success: z.boolean(),
  run_id: NodeIdSchema,
  branches: z.array(WikiOneStepBranchResultSchema).min(1),
  wikis: z.array(KnowledgeWikiPageSchema).default([]),
  warnings: z.array(z.string()).default([]),
});

export type CreateTranscriptWikisRequest = z.infer<typeof CreateTranscriptWikisRequestSchema>;
export type WikiOneStepBranchOutcome = z.infer<typeof WikiOneStepBranchOutcomeSchema>;
export type WikiOneStepInternalStage = z.infer<typeof WikiOneStepInternalStageSchema>;
export type WikiOneStepBranchResult = z.infer<typeof WikiOneStepBranchResultSchema>;
export type CreateTranscriptWikisResponse = z.infer<typeof CreateTranscriptWikisResponseSchema>;

export const DEFAULT_WIKI_AUTO_PROMOTION_QUALITY_THRESHOLD = 80;

export interface EvaluateWikiAutoPromotionPolicyInput {
  operation: WikiOperation;
  verificationStatus: WikiVerificationStatus;
  qualityScore: number;
  qualityThreshold?: number;
  coherencePassed: boolean;
  evidenceGatesPassed: boolean;
  hasValidLinks: boolean;
  hasValidSourceRefs: boolean;
  /** Required true for update; ignored for create/no-op. */
  baseRevisionMatches?: boolean;
  /**
   * True when the orchestrator invented a distinct topic key (e.g. `topic-2`) to bypass
   * ambiguity. Refined policy must never allow this.
   */
  inventedSuffixedTopicKey?: boolean;
  sourceRefs?: WikiSourceRef[];
  contestedClaimEvidence?: WikiContestedClaimEvidence[];
  evidenceMetrics?: WikiEvidenceMetrics;
  /** When present, per-dimension thresholds gate promotion (coverage cannot mask coherence). */
  qualityDimensions?: WikiQualityReport;
}

export interface EvaluateWikiAutoPromotionPolicyResult {
  allow: boolean;
  outcome: WikiOneStepBranchOutcome;
  reasons: string[];
}

/**
 * Deterministic auto-promotion gate for the one-step pipeline.
 * Ambiguous/contested/stale/low-quality branches skip or fail — never invent a create topic.
 */
export function evaluateWikiAutoPromotionPolicy(
  input: EvaluateWikiAutoPromotionPolicyInput,
): EvaluateWikiAutoPromotionPolicyResult {
  const reasons: string[] = [];
  const threshold = input.qualityThreshold ?? DEFAULT_WIKI_AUTO_PROMOTION_QUALITY_THRESHOLD;
  const verification =
    input.sourceRefs !== undefined
      ? determineWikiVerificationStatus({
          sourceRefs: input.sourceRefs,
          contestedClaimEvidence: input.contestedClaimEvidence,
          evidenceMetrics: input.evidenceMetrics,
          currentVerificationStatus: input.verificationStatus,
        })
      : input.verificationStatus;

  if (input.inventedSuffixedTopicKey) {
    reasons.push('Invented suffixed topic keys are prohibited.');
    return { allow: false, outcome: 'failed', reasons };
  }

  if (input.operation === 'needs-review') {
    reasons.push('Unresolved needs-review cannot auto-promote.');
    return { allow: false, outcome: 'skipped', reasons };
  }

  if (verification === 'contested') {
    reasons.push('Contested verification blocks auto-promotion.');
    return { allow: false, outcome: 'skipped', reasons };
  }

  if (input.qualityDimensions) {
    if (!input.qualityDimensions.passed) {
      const failed = input.qualityDimensions.blocking_dimensions.join(', ') || 'unknown';
      reasons.push(`Quality dimension gate failed: ${failed}.`);
      return { allow: false, outcome: 'failed', reasons };
    }
  } else if (!input.coherencePassed) {
    reasons.push('Topic coherence gate failed.');
    return { allow: false, outcome: 'failed', reasons };
  }

  if (!input.evidenceGatesPassed) {
    reasons.push('Evidence role/coverage gate failed.');
    return { allow: false, outcome: 'failed', reasons };
  }

  if (!input.hasValidSourceRefs) {
    reasons.push('Source refs are invalid or incomplete.');
    return { allow: false, outcome: 'failed', reasons };
  }

  if (!input.hasValidLinks) {
    reasons.push('Proposed links are invalid.');
    return { allow: false, outcome: 'failed', reasons };
  }

  const effectiveQualityScore = input.qualityDimensions?.overall_score ?? input.qualityScore;
  if (effectiveQualityScore < threshold) {
    reasons.push(`Quality score ${effectiveQualityScore} is below threshold ${threshold}.`);
    return { allow: false, outcome: 'failed', reasons };
  }

  if (input.operation === 'no-op') {
    return {
      allow: true,
      outcome: 'existing-no-op',
      reasons: ['Evidence already represented by an existing promoted wiki.'],
    };
  }

  if (input.operation === 'update') {
    if (input.baseRevisionMatches !== true) {
      reasons.push('Update requires a matching base revision/hash.');
      return { allow: false, outcome: 'failed', reasons };
    }
    return { allow: true, outcome: 'promoted-update', reasons: ['Update passed auto-promotion gates.'] };
  }

  if (input.operation === 'create') {
    return { allow: true, outcome: 'promoted-create', reasons: ['Create passed auto-promotion gates.'] };
  }

  const _exhaustive: never = input.operation;
  reasons.push(`Unsupported operation: ${String(_exhaustive)}`);
  return { allow: false, outcome: 'failed', reasons };
}

/** Overall success: at least one promoted create/update or confidently matched existing wiki. */
export function isWikiOneStepOverallSuccess(branches: WikiOneStepBranchResult[]): boolean {
  return branches.some(
    (branch) =>
      branch.outcome === 'promoted-create' ||
      branch.outcome === 'promoted-update' ||
      branch.outcome === 'existing-no-op',
  );
}

/** User-facing branch counts — never includes draft/candidate ids. */
export function summarizeWikiOneStepBranches(branches: Array<{ outcome: WikiOneStepBranchOutcome }>): string {
  const counts = {
    created: 0,
    updated: 0,
    represented: 0,
    skipped: 0,
    failed: 0,
  };
  for (const branch of branches) {
    switch (branch.outcome) {
      case 'promoted-create':
        counts.created += 1;
        break;
      case 'promoted-update':
        counts.updated += 1;
        break;
      case 'existing-no-op':
        counts.represented += 1;
        break;
      case 'skipped':
        counts.skipped += 1;
        break;
      case 'failed':
        counts.failed += 1;
        break;
      default: {
        const exhaustive: never = branch.outcome;
        void exhaustive;
        break;
      }
    }
  }

  const parts: string[] = [];
  if (counts.created > 0) parts.push(`${counts.created} created`);
  if (counts.updated > 0) parts.push(`${counts.updated} updated`);
  if (counts.represented > 0) parts.push(`${counts.represented} already represented`);
  if (counts.skipped > 0) parts.push(`${counts.skipped} skipped`);
  if (counts.failed > 0) parts.push(`${counts.failed} failed`);
  return parts.join(' · ');
}

export function formatWikiOneStepSuccessMessage(input: {
  wikiCount: number;
  branches: Array<{ outcome: WikiOneStepBranchOutcome }>;
}): string {
  const branchSummary = input.branches.length > 0 ? summarizeWikiOneStepBranches(input.branches) : undefined;
  if (input.wikiCount <= 1) {
    return branchSummary ? `Wiki published (${branchSummary}).` : 'Wiki published.';
  }
  return branchSummary
    ? `${input.wikiCount} focused wikis published (${branchSummary}).`
    : `${input.wikiCount} focused wikis published.`;
}

/** Normal success must never deep-link users into draft/candidate review routes. */
export function isForbiddenWikiCreationPath(path: string): boolean {
  return /\/vault\/wiki-(?:drafts|candidates)\//.test(path);
}

const FORBIDDEN_DRAFT_PROMOTION_UX =
  /(?:open|review|inspect).{0,40}(?:draft|wiki-draft).{0,40}promot|promot.{0,40}(?:draft|wiki-draft)|\/vault\/wiki-drafts\//i;

/** Normal-flow messages must not instruct the user to open a draft and promote it. */
export function containsForbiddenDraftPromotionUx(message: string): boolean {
  return FORBIDDEN_DRAFT_PROMOTION_UX.test(message);
}

export function assertNoForbiddenDraftPromotionUx(messages: string[]): void {
  for (const message of messages) {
    if (!containsForbiddenDraftPromotionUx(message)) continue;
    throw new Error(`Forbidden draft-promotion UX in one-step response: ${message}`);
  }
}

/** Bounded internal correction: at most one automatic retry/re-resolve, then terminate. */
export const WIKI_ONE_STEP_MAX_INTERNAL_CORRECTION_ATTEMPTS = 1;

export function shouldAttemptInternalCorrection(input: {
  attempt: number;
  failureKind: 'malformed-output' | 'low-coherence' | 'ambiguous-topic' | 'terminal';
}): boolean {
  if (input.failureKind === 'terminal') return false;
  return input.attempt < WIKI_ONE_STEP_MAX_INTERNAL_CORRECTION_ATTEMPTS;
}

export const WikiOneStepUserActionSchema = z.literal('create-wikis');

export type WikiOneStepUserAction = z.infer<typeof WikiOneStepUserActionSchema>;

/** Only normal user action for transcript wiki creation. */
export const WIKI_ONE_STEP_USER_ACTION: WikiOneStepUserAction = 'create-wikis';

export { WikiValidationIssueSchema };
