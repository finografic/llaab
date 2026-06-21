import { z } from 'zod';

import { BaseNodeSchema } from './base-node.schema.js';
import { NodeIdSchema } from './primitives.schema.js';

export const TranscriptSourceTypeSchema = z.enum(['youtube', 'article', 'repo', 'chat', 'other']);

const TranscriptCanonicalCoverageItemSchema = z.object({
  id: NodeIdSchema,
  reason: z.string().optional(),
});

export const TranscriptCanonicalCoverageSchema = z.object({
  canonical_idea_ids: z.array(NodeIdSchema).default([]),
  candidate_idea_ids: z.array(NodeIdSchema).default([]),
  covered_candidate_idea_ids: z.array(NodeIdSchema).default([]),
  omitted_candidate_idea_ids: z.array(TranscriptCanonicalCoverageItemSchema).default([]),
  missed_candidate_idea_ids: z.array(TranscriptCanonicalCoverageItemSchema).default([]),
  quality_score: z.number().int().min(0).max(100).optional(),
  warning: z.string().optional(),
  updated_at: z.string().datetime(),
});

export type TranscriptCanonicalCoverage = z.infer<typeof TranscriptCanonicalCoverageSchema>;

export const TranscriptNodeSchema = BaseNodeSchema.extend({
  type: z.literal('transcript'),
  source_id: NodeIdSchema.optional(),
  source_item_id: z.string().min(1).optional(),
  source_url: z.string().url(),
  source_type: TranscriptSourceTypeSchema,
  /** Source publication time, e.g. YouTube upload timestamp, when known. */
  source_published_at: z.string().datetime().optional(),
  author: z.string().optional(),
  summary: z.string().optional(),
  raw_length: z.number().int().nonnegative().optional(),
  clean_length: z.number().int().nonnegative().optional(),
  structured_paragraphs: z.number().int().nonnegative().optional(),
  extracted_idea_ids: z.array(NodeIdSchema).default([]),
  extracted_skill_ids: z.array(NodeIdSchema).default([]),
  canonical_coverage: TranscriptCanonicalCoverageSchema.optional(),
  llm_model: z.string().optional(),
  llm_provider: z.string().optional(),
  llm_duration_ms: z.number().int().nonnegative().optional(),
  llm_prompt_tokens: z.number().int().nonnegative().optional(),
  llm_completion_tokens: z.number().int().nonnegative().optional(),
});

export type TranscriptNode = z.infer<typeof TranscriptNodeSchema>;
export type TranscriptSourceType = z.infer<typeof TranscriptSourceTypeSchema>;
