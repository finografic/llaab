import { z } from 'zod';

import { BaseNodeSchema } from './base-node.schema.js';
import { NodeIdSchema } from './primitives.schema.js';

export const CanonicalIdeaConfidenceSchema = z.enum(['low', 'medium', 'high']);

export const CanonicalIdeaNodeSchema = BaseNodeSchema.extend({
  type: z.literal('canonical-idea'),
  transcript_id: NodeIdSchema,
  /** May be empty after source candidate ideas are deleted; consolidate still writes ≥1. */
  source_candidate_idea_ids: z.array(NodeIdSchema).default([]),
  confidence: CanonicalIdeaConfidenceSchema.optional(),
  key_claims: z.array(z.string()).default([]),
  coverage_notes: z.string().optional(),
  llm_model: z.string().optional(),
  llm_provider: z.string().optional(),
  llm_duration_ms: z.number().int().nonnegative().optional(),
  llm_prompt_tokens: z.number().int().nonnegative().optional(),
  llm_completion_tokens: z.number().int().nonnegative().optional(),
});

export type CanonicalIdeaConfidence = z.infer<typeof CanonicalIdeaConfidenceSchema>;
export type CanonicalIdeaNode = z.infer<typeof CanonicalIdeaNodeSchema>;
