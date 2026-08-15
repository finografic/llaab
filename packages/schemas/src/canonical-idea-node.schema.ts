import { z } from 'zod';

import { BaseNodeSchema } from './base-node.schema.js';
import { NodeIdSchema } from './primitives.schema.js';

export const CanonicalIdeaConfidenceSchema = z.enum(['low', 'medium', 'high']);

export const CanonicalIdeaNodeSchema = BaseNodeSchema.extend({
  type: z.literal('canonical-idea'),
  /** Legacy source pointer used by transcript-first wiki/consolidation code. */
  transcript_id: NodeIdSchema,
  /** Preferred source pointer for non-transcript source nodes. */
  source_node_id: NodeIdSchema.optional(),
  source_node_type: z.enum(['transcript', 'resource']).optional(),
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
