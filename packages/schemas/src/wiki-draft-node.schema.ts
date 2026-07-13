import { z } from 'zod';

import { BaseNodeSchema } from './base-node.schema.js';
import { NodeIdSchema, TimestampSchema } from './primitives.schema.js';
import {
  WikiDraftStatusSchema,
  WikiLinkSchema,
  WikiOperationSchema,
  WikiSectionDraftSchema,
  WikiSectionPatchSchema,
  WikiSourceRefSchema,
  WikiValidationIssueSchema,
} from './wiki.schema.js';

export const WikiDraftNodeSchema = BaseNodeSchema.extend({
  type: z.literal('wiki-draft'),
  topic_key: NodeIdSchema,
  target_wiki_id: NodeIdSchema.optional(),
  operation: WikiOperationSchema,
  draft_status: WikiDraftStatusSchema.default('proposed'),
  source_canonical_idea_ids: z.array(NodeIdSchema).default([]),
  source_transcript_ids: z.array(NodeIdSchema).default([]),
  source_ids: z.array(NodeIdSchema).default([]),
  proposed_links: z.array(WikiLinkSchema).default([]),
  source_refs: z.array(WikiSourceRefSchema).default([]),
  represented_canonical_idea_ids: z.array(NodeIdSchema).default([]),
  omitted_canonical_idea_ids: z.array(NodeIdSchema).default([]),
  sections: z.array(WikiSectionDraftSchema).default([]),
  patch: z.array(WikiSectionPatchSchema).default([]),
  base_revision: z.number().int().positive().optional(),
  base_content_hash: z
    .string()
    .regex(/^[a-f0-9]{64}$/)
    .optional(),
  quality_score: z.number().int().min(0).max(100).optional(),
  warning: z.string().min(1).optional(),
  validation_issues: z.array(WikiValidationIssueSchema).default([]),
  change_summary: z.string().optional(),
  unresolved_questions: z.array(z.string()).default([]),
  contested_claims: z.array(z.string()).default([]),
  run_id: NodeIdSchema.optional(),
  reviewer_edits: z.boolean().default(false),
  promoted_wiki_id: NodeIdSchema.optional(),
  promoted_revision: z.number().int().positive().optional(),
  reviewed_at: TimestampSchema.optional(),
  review_decisions: z
    .array(
      z.object({
        at: TimestampSchema,
        decision: z.enum(['promoted', 'rejected']),
        reason: z.string().min(1),
      }),
    )
    .default([]),
  llm_model: z.string().optional(),
  llm_provider: z.string().optional(),
  llm_duration_ms: z.number().int().nonnegative().optional(),
  llm_prompt_tokens: z.number().int().nonnegative().optional(),
  llm_completion_tokens: z.number().int().nonnegative().optional(),
});

export type WikiDraftNode = z.infer<typeof WikiDraftNodeSchema>;
