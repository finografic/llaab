import { z } from 'zod';

import { BaseNodeSchema } from './base-node.schema.js';
import { NodeIdSchema, TimestampSchema } from './primitives.schema.js';
import { WikiEvidenceMetricsSchema } from './wiki-evidence-metrics.js';
import { WikiQualityReportSchema } from './wiki-quality-dimensions.js';
import {
  WikiDraftStatusSchema,
  WikiContestedClaimEvidenceSchema,
  WikiLinkSchema,
  WikiOperationSchema,
  WikiNoveltyAnalysisSchema,
  WikiSectionDraftSchema,
  WikiSectionPatchSchema,
  WikiSourceRefSchema,
  WikiValidationIssueSchema,
} from './wiki.schema.js';

export const WikiDraftNodeSchema = BaseNodeSchema.extend({
  type: z.literal('wiki-draft'),
  topic_key: NodeIdSchema,
  target_wiki_id: NodeIdSchema.optional(),
  operation: WikiOperationSchema,
  entry_path: z.enum(['manual', 'automatic']).default('manual'),
  draft_status: WikiDraftStatusSchema.default('proposed'),
  source_canonical_idea_ids: z.array(NodeIdSchema).default([]),
  /** Empty means fall back to `source_canonical_idea_ids` for legacy drafts. */
  primary_canonical_idea_ids: z.array(NodeIdSchema).default([]),
  supporting_canonical_idea_ids: z.array(NodeIdSchema).default([]),
  discovery_batch_id: NodeIdSchema.optional(),
  proposal_id: NodeIdSchema.optional(),
  proposal_rationale: z.string().min(1).optional(),
  /** Parent Create Wiki(s) orchestration run id. */
  parent_run_id: NodeIdSchema.optional(),
  /** Harmless schema-drift normalization steps applied during compile. */
  normalization_actions: z.array(z.string().min(1)).default([]),
  source_transcript_ids: z.array(NodeIdSchema).default([]),
  source_ids: z.array(NodeIdSchema).default([]),
  proposed_links: z.array(WikiLinkSchema).default([]),
  source_refs: z.array(WikiSourceRefSchema).default([]),
  represented_canonical_idea_ids: z.array(NodeIdSchema).default([]),
  omitted_canonical_idea_ids: z.array(NodeIdSchema).default([]),
  omitted_canonical_ideas: z.array(z.object({ id: NodeIdSchema, reason: z.string().min(1) })).default([]),
  sections: z.array(WikiSectionDraftSchema).default([]),
  patch: z.array(WikiSectionPatchSchema).default([]),
  resulting_body: z.string().optional(),
  unchanged_section_ids: z.array(NodeIdSchema).default([]),
  base_revision: z.number().int().positive().optional(),
  base_content_hash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  quality_score: z.number().int().min(0).max(100).optional(),
  quality_dimensions: WikiQualityReportSchema.optional(),
  selected_canonical_idea_count: z.number().int().nonnegative().optional(),
  selected_transcript_count: z.number().int().nonnegative().optional(),
  /** @deprecated Prefer `evidence_metrics.unique_source_node_count`. */
  selected_source_count: z.number().int().nonnegative().optional(),
  evidence_metrics: WikiEvidenceMetricsSchema.optional(),
  novelty_reason: z.string().min(1).optional(),
  novelty_analysis: WikiNoveltyAnalysisSchema.optional(),
  warning: z.string().min(1).optional(),
  validation_issues: z.array(WikiValidationIssueSchema).default([]),
  change_summary: z.string().optional(),
  unresolved_questions: z.array(z.string()).default([]),
  contested_claims: z.array(z.string()).default([]),
  contested_claim_evidence: z.array(WikiContestedClaimEvidenceSchema).default([]),
  topic_matches: z
    .array(
      z.object({
        wiki_id: NodeIdSchema,
        kind: z.enum([
          'exact-topic-key',
          'alias',
          'normalized-title',
          'canonical-idea-overlap',
          'fine-tag-overlap',
          'domain-tag-overlap',
        ]),
        reason: z.string().min(1),
      }),
    )
    .default([]),
  run_id: NodeIdSchema.optional(),
  reviewer_edits: z.boolean().default(false),
  promoted_wiki_id: NodeIdSchema.optional(),
  promoted_revision: z.number().int().positive().optional(),
  reviewed_at: TimestampSchema.optional(),
  review_decisions: z
    .array(
      z.object({
        at: TimestampSchema,
        decision: z.enum(['promoted', 'rejected']),
        reason: z.string().min(1),
      }),
    )
    .default([]),
  llm_model: z.string().optional(),
  llm_provider: z.string().optional(),
  llm_duration_ms: z.number().int().nonnegative().optional(),
  llm_prompt_tokens: z.number().int().nonnegative().optional(),
  llm_completion_tokens: z.number().int().nonnegative().optional(),
});

export type WikiDraftNode = z.infer<typeof WikiDraftNodeSchema>;
