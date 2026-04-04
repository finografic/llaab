import { z } from 'zod';

import { BaseNodeSchema } from './base-node.schema.js';
import { NodeIdSchema } from './primitives.schema.js';

export const TranscriptSourceTypeSchema = z.enum(['youtube', 'article', 'repo', 'chat', 'other']);

export const TranscriptNodeSchema = BaseNodeSchema.extend({
  type: z.literal('transcript'),
  sourceUrl: z.string().url(),
  sourceType: TranscriptSourceTypeSchema,
  author: z.string().optional(),
  summary: z.string().optional(),
  rawLength: z.number().int().nonnegative().optional(),
  cleanLength: z.number().int().nonnegative().optional(),
  structuredParagraphs: z.number().int().nonnegative().optional(),
  extractedIdeaIds: z.array(NodeIdSchema).default([]),
  extractedSkillIds: z.array(NodeIdSchema).default([]),
});

export type TranscriptNode = z.infer<typeof TranscriptNodeSchema>;
export type TranscriptSourceType = z.infer<typeof TranscriptSourceTypeSchema>;
