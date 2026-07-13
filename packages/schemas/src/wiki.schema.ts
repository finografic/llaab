import { z } from 'zod';

import { NodeIdSchema } from './primitives.schema.js';

export const WikiOperationSchema = z.enum(['create', 'update', 'no-op', 'needs-review']);
export const WikiDraftStatusSchema = z.enum(['proposed', 'accepted', 'rejected', 'superseded']);
export const WikiVerificationStatusSchema = z.enum(['source-backed', 'corroborated', 'contested']);
export const WikiLifecycleStatusSchema = z.enum(['seed', 'growing', 'mature']);
export const WikiLinkRelationSchema = z.enum([
  'related-to',
  'depends-on',
  'extends',
  'contrasts-with',
  'example-of',
  'supports',
  'supersedes',
]);

export const WikiSourceRefKindSchema = z.enum(['canonical-idea', 'transcript', 'source', 'external']);

export const WikiSourceRefSchema = z.object({
  id: NodeIdSchema,
  kind: WikiSourceRefKindSchema,
  node_id: NodeIdSchema.optional(),
  title: z.string().min(1).optional(),
  url: z.url().optional(),
  locator: z.string().min(1).optional(),
  verification: WikiVerificationStatusSchema,
});

export const WikiLinkSchema = z.object({
  target_wiki_id: NodeIdSchema,
  relation: WikiLinkRelationSchema,
  note: z.string().min(1).optional(),
});

export const WikiSectionDraftSchema = z.object({
  id: NodeIdSchema,
  heading: z.string().min(1),
  body: z.string(),
  source_ref_ids: z.array(NodeIdSchema).default([]),
  source_canonical_idea_ids: z.array(NodeIdSchema).default([]),
});

export const WikiSectionPatchSchema = z.object({
  section_id: NodeIdSchema,
  operation: z.enum(['add', 'update', 'remove', 'unchanged']),
  before: z.string().optional(),
  after: z.string().optional(),
});

export const WikiOmittedCanonicalIdeaSchema = z.object({
  id: NodeIdSchema,
  reason: z.string().min(1),
});

export const WikiValidationIssueSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
});

export const WikiQualityResultSchema = z.object({
  score: z.number().int().min(0).max(100),
  issues: z.array(WikiValidationIssueSchema).default([]),
});

export const WikiTopicResolutionSchema = z.object({
  operation: WikiOperationSchema,
  target_wiki_id: NodeIdSchema.optional(),
  reason: z.string().min(1),
});

export const WikiTopicMatchSchema = z.object({
  wiki_id: NodeIdSchema,
  kind: z.enum([
    'exact-topic-key',
    'alias',
    'normalized-title',
    'canonical-idea-overlap',
    'domain-tag-overlap',
  ]),
  reason: z.string().min(1),
});

export const WikiEvidenceItemSchema = z.object({
  id: NodeIdSchema,
  canonical_idea_id: NodeIdSchema,
  transcript_id: NodeIdSchema,
  source_id: NodeIdSchema.optional(),
  source_url: z.url().optional(),
  title: z.string().min(1),
  excerpt: z.string().min(1),
  locator: z.string().min(1).optional(),
  confidence: z.enum(['low', 'medium', 'high']),
});

export const WikiCompileTopicSchema = z.object({
  topic_key: NodeIdSchema,
  suggested_title: z.string().min(1),
  aliases: z.array(z.string().min(1)).default([]),
});

export const WikiCanonicalIdeaPayloadSchema = z.object({
  id: NodeIdSchema,
  transcript_id: NodeIdSchema,
  title: z.string().min(1),
  body: z.string(),
  key_claims: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
});

export const WikiCompileInputSchema = z.object({
  operation: z.enum(['create', 'update']),
  topic: WikiCompileTopicSchema,
  selected_canonical_ideas: z.array(WikiCanonicalIdeaPayloadSchema).min(1),
  evidence: z.array(WikiEvidenceItemSchema).min(1),
  existing_wiki_id: NodeIdSchema.optional(),
  related_wikis: z
    .array(
      z.object({
        id: NodeIdSchema,
        title: z.string().min(1),
        summary: z.string(),
        tags: z.array(z.string()).default([]),
      }),
    )
    .default([]),
  constraints: z.object({
    preserve_manual_content: z.literal(true),
    require_source_refs: z.literal(true),
    prefer_delta_update: z.literal(true),
  }),
});

export const WikiCompileResultSchema = z.object({
  operation: WikiOperationSchema,
  topic: z.object({
    topic_key: NodeIdSchema,
    title: z.string().min(1),
    aliases: z.array(z.string().min(1)).default([]),
  }),
  summary: z.string(),
  sections: z.array(WikiSectionDraftSchema).default([]),
  links: z.array(WikiLinkSchema).default([]),
  source_refs: z.array(WikiSourceRefSchema).default([]),
  coverage: z.object({
    represented_canonical_idea_ids: z.array(NodeIdSchema).default([]),
    omitted_canonical_ideas: z.array(WikiOmittedCanonicalIdeaSchema).default([]),
  }),
  change_summary: z.string(),
  unresolved_questions: z.array(z.string()).default([]),
  contested_claims: z.array(z.string()).default([]),
});

export const CreateWikiDraftRequestSchema = z.object({
  canonical_idea_ids: z.array(NodeIdSchema).min(1),
  target_wiki_id: NodeIdSchema.optional(),
  suggested_title: z.string().min(1).optional(),
});

export const WikiResearchRequestSchema = z
  .object({
    wiki_id: NodeIdSchema.optional(),
    draft_id: NodeIdSchema.optional(),
    query: z.string().min(3).max(500),
    provider: z.enum(['manual']).default('manual'),
    max_results: z.number().int().min(1).max(10).default(5),
    approval: z.literal(true),
  })
  .refine((request) => request.wiki_id !== undefined || request.draft_id !== undefined, {
    message: 'Provide a wiki or draft target for research.',
  });

export const WikiTagSchema = z.string().regex(/^d:[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use a d: domain tag');

export type WikiCompileInput = z.infer<typeof WikiCompileInputSchema>;
export type WikiCompileResult = z.infer<typeof WikiCompileResultSchema>;
export type WikiDraftStatus = z.infer<typeof WikiDraftStatusSchema>;
export type WikiEvidenceItem = z.infer<typeof WikiEvidenceItemSchema>;
export type WikiLifecycleStatus = z.infer<typeof WikiLifecycleStatusSchema>;
export type WikiLink = z.infer<typeof WikiLinkSchema>;
export type WikiLinkRelation = z.infer<typeof WikiLinkRelationSchema>;
export type WikiOmittedCanonicalIdea = z.infer<typeof WikiOmittedCanonicalIdeaSchema>;
export type WikiOperation = z.infer<typeof WikiOperationSchema>;
export type WikiQualityResult = z.infer<typeof WikiQualityResultSchema>;
export type WikiSectionDraft = z.infer<typeof WikiSectionDraftSchema>;
export type WikiSectionPatch = z.infer<typeof WikiSectionPatchSchema>;
export type WikiSourceRef = z.infer<typeof WikiSourceRefSchema>;
export type WikiTopicResolution = z.infer<typeof WikiTopicResolutionSchema>;
export type WikiTopicMatch = z.infer<typeof WikiTopicMatchSchema>;
export type WikiValidationIssue = z.infer<typeof WikiValidationIssueSchema>;
export type WikiVerificationStatus = z.infer<typeof WikiVerificationStatusSchema>;
export type WikiResearchRequest = z.infer<typeof WikiResearchRequestSchema>;
