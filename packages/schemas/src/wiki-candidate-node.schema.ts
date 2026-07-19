import { z } from 'zod';

import { BaseNodeSchema } from './base-node.schema.js';
import { NodeIdSchema } from './primitives.schema.js';
import { WikiEvidenceMetricsSchema } from './wiki-evidence-metrics.js';
import { WikiOmittedCanonicalIdeaSchema, WikiOperationSchema } from './wiki.schema.js';

/**
 * Vault wiki-candidate node.
 * Historical files keep `source_canonical_idea_ids` only; newer discovery writes optional
 * primary/supporting roles and batch identity with backward-compatible defaults.
 */
export const WikiCandidateNodeSchema = BaseNodeSchema.extend({
  type: z.literal('wiki-candidate'),
  topic_key: NodeIdSchema,
  source_canonical_idea_ids: z.array(NodeIdSchema).min(1),
  source_transcript_ids: z.array(NodeIdSchema).min(1),
  source_ids: z.array(NodeIdSchema).default([]),
  heat_score: z.number().min(0).max(100),
  novelty_score: z.number().min(0).max(100),
  recommendation: WikiOperationSchema,
  existing_wiki_ids: z.array(NodeIdSchema).default([]),
  warnings: z.array(z.string()).default([]),
  /** Empty means fall back to `source_canonical_idea_ids` for legacy candidates. */
  primary_canonical_idea_ids: z.array(NodeIdSchema).default([]),
  supporting_canonical_idea_ids: z.array(NodeIdSchema).default([]),
  rationale: z.string().min(1).optional(),
  discovery_batch_id: NodeIdSchema.optional(),
  proposal_id: NodeIdSchema.optional(),
  coherence_score: z.number().min(0).max(100).optional(),
  omitted_canonical_ideas: z.array(WikiOmittedCanonicalIdeaSchema).default([]),
  evidence_metrics: WikiEvidenceMetricsSchema.optional(),
  llm_model: z.string().optional(),
  llm_provider: z.string().optional(),
  llm_duration_ms: z.number().int().nonnegative().optional(),
});

export type WikiCandidateNode = z.infer<typeof WikiCandidateNodeSchema>;
