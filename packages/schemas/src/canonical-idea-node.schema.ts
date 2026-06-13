import { z } from 'zod';

import { BaseNodeSchema } from './base-node.schema.js';
import { NodeIdSchema } from './primitives.schema.js';

export const CanonicalIdeaConfidenceSchema = z.enum(['low', 'medium', 'high']);

export const CanonicalIdeaNodeSchema = BaseNodeSchema.extend({
  type: z.literal('canonical-idea'),
  transcript_id: NodeIdSchema,
  source_candidate_idea_ids: z.array(NodeIdSchema).min(1),
  confidence: CanonicalIdeaConfidenceSchema.optional(),
  llm_model: z.string().optional(),
  llm_provider: z.string().optional(),
  llm_duration_ms: z.number().int().nonnegative().optional(),
  llm_prompt_tokens: z.number().int().nonnegative().optional(),
  llm_completion_tokens: z.number().int().nonnegative().optional(),
});

export type CanonicalIdeaConfidence = z.infer<typeof CanonicalIdeaConfidenceSchema>;
export type CanonicalIdeaNode = z.infer<typeof CanonicalIdeaNodeSchema>;
