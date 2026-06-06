import { z } from 'zod';

import { BaseNodeSchema } from './base-node.schema.js';
import { NodeIdSchema } from './primitives.schema.js';

export const IdeaNodeSchema = BaseNodeSchema.extend({
  type: z.literal('idea'),
  origin: z.enum(['manual', 'extracted', 'generated']).default('manual'),
  source_id: NodeIdSchema.optional(),
  llm_model: z.string().optional(),
  llm_provider: z.string().optional(),
  llm_duration_ms: z.number().int().nonnegative().optional(),
  llm_prompt_tokens: z.number().int().nonnegative().optional(),
  llm_completion_tokens: z.number().int().nonnegative().optional(),
});

export type IdeaNode = z.infer<typeof IdeaNodeSchema>;
