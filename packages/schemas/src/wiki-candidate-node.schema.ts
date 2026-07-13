import { z } from 'zod';

import { BaseNodeSchema } from './base-node.schema.js';
import { NodeIdSchema } from './primitives.schema.js';
import { WikiOperationSchema } from './wiki.schema.js';

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
  llm_model: z.string().optional(),
  llm_provider: z.string().optional(),
  llm_duration_ms: z.number().int().nonnegative().optional(),
});

export type WikiCandidateNode = z.infer<typeof WikiCandidateNodeSchema>;
