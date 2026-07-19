import { z } from 'zod';

import { NodeIdSchema, TimestampSchema } from '../primitives.schema.js';
import {
  WikiLifecycleStatusSchema,
  WikiLinkSchema,
  WikiSourceRefSchema,
  WikiTagSchema,
  WikiVerificationStatusSchema,
} from '../wiki.schema.js';

export const KnowledgeWikiPageSchema = z.object({
  id: NodeIdSchema,
  type: z.literal('wiki'),
  topic_key: NodeIdSchema,
  title: z.string().min(1),
  aliases: z.array(z.string().min(1)).default([]),
  summary: z.string(),
  body: z.string(),
  status: WikiLifecycleStatusSchema,
  tags: z.array(WikiTagSchema).default([]),
  links: z.array(WikiLinkSchema).default([]),
  source_refs: z.array(WikiSourceRefSchema).default([]),
  source_canonical_idea_ids: z.array(NodeIdSchema).default([]),
  source_transcript_ids: z.array(NodeIdSchema).default([]),
  revision: z.number().int().positive(),
  created_at: TimestampSchema,
  updated_at: TimestampSchema,
  reviewed_at: TimestampSchema.optional(),
  verification_status: WikiVerificationStatusSchema,
  quality_score: z.number().int().min(0).max(100).optional(),
  generation_provider: z.string().min(1).optional(),
  generation_model: z.string().min(1).optional(),
  generation_duration_ms: z.number().int().nonnegative().optional(),
});

export type KnowledgeWikiPage = z.infer<typeof KnowledgeWikiPageSchema>;
