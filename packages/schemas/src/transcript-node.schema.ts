import { z } from 'zod';

import { BaseNodeSchema } from './base-node.schema.js';
import { NodeIdSchema } from './primitives.schema.js';

export const TranscriptSourceTypeSchema = z.enum(['youtube', 'article', 'repo', 'chat', 'other']);

export const TranscriptNodeSchema = BaseNodeSchema.extend({
  type: z.literal('transcript'),
  source_id: NodeIdSchema.optional(),
  source_item_id: z.string().min(1).optional(),
  source_url: z.string().url(),
  source_type: TranscriptSourceTypeSchema,
  author: z.string().optional(),
  summary: z.string().optional(),
  raw_length: z.number().int().nonnegative().optional(),
  clean_length: z.number().int().nonnegative().optional(),
  structured_paragraphs: z.number().int().nonnegative().optional(),
  extracted_idea_ids: z.array(NodeIdSchema).default([]),
  extracted_skill_ids: z.array(NodeIdSchema).default([]),
});

export type TranscriptNode = z.infer<typeof TranscriptNodeSchema>;
export type TranscriptSourceType = z.infer<typeof TranscriptSourceTypeSchema>;
