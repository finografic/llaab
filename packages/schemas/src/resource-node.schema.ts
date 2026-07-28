import { z } from 'zod';

import { BaseNodeSchema } from './base-node.schema.js';
import { NodeIdSchema } from './primitives.schema.js';

export const ResourceTypeSchema = z.enum([
  'tool',
  'package',
  'library',
  'api',
  'dataset',
  'reference',
  'article',
  'repo',
  'other',
]);

export const ResourceNodeSchema = BaseNodeSchema.extend({
  type: z.literal('resource'),
  source_id: NodeIdSchema.optional(),
  /** Canonical URL — durable identity used for article deduplication. */
  url: z.string().url().optional(),
  resource_type: ResourceTypeSchema.default('reference'),
  description: z.string().optional(),

  // Article provenance. Set by article ingestion; absent on other resource kinds.
  /** URL originally supplied by the operator, before redirects and canonicalization. */
  requested_url: z.string().url().optional(),
  author: z.string().optional(),
  site_name: z.string().optional(),
  /** Publication date declared by the page, as ISO 8601 UTC. */
  source_published_at: z.string().optional(),
  /** When LLAAB retrieved the content, as ISO 8601 UTC. */
  fetched_at: z.string().optional(),
  /** SHA-256 of the normalized article text — content identity independent of the URL. */
  content_hash: z.string().optional(),
  /** True when the stored body was capped at the maximum article length. */
  content_truncated: z.boolean().optional(),
  /** Idea nodes produced by extraction from this resource. */
  extracted_idea_ids: z.array(NodeIdSchema).default([]),

  // Extraction trace. Resources use `description` as their summary field, so there is no `summary`.
  llm_model: z.string().optional(),
  llm_provider: z.string().optional(),
  llm_duration_ms: z.number().int().nonnegative().optional(),
  llm_prompt_tokens: z.number().int().nonnegative().optional(),
  llm_completion_tokens: z.number().int().nonnegative().optional(),
});

export type ResourceNode = z.infer<typeof ResourceNodeSchema>;
export type ResourceType = z.infer<typeof ResourceTypeSchema>;
