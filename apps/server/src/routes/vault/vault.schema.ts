import {
  CreateWikiDraftRequestSchema,
  WikiResearchRequestSchema,
  NodeTypeSchema,
  SourceProfileSchema,
  TranscriptCanonicalCoverageSchema,
} from '@llaab/schemas';
import { z } from 'zod';

export const listNodesQuerySchema = z.object({
  type: NodeTypeSchema.optional(),
  status: z.enum(['seed', 'growing', 'mature', 'archived']).optional(),
  tags: z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      const parts = Array.isArray(val) ? val : val.split(',');
      const tags = parts.map((tag) => tag.trim()).filter(Boolean);
      return tags.length > 0 ? tags : undefined;
    }),
  search: z.string().optional(),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => {
      if (val === undefined) return undefined;
      const parsed = typeof val === 'number' ? val : Number.parseInt(val, 10);
      return Number.isFinite(parsed) ? parsed : undefined;
    }),
});

export type ListNodesQuery = z.infer<typeof listNodesQuerySchema>;

export const createNodeBodySchema = z.object({
  type: z.literal('idea'),
  title: z.string().min(1, 'Title is required'),
  body: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateNodeBody = z.infer<typeof createNodeBodySchema>;

export const createResourceNodeBodySchema = z.object({
  type: z.literal('resource'),
  title: z.string().min(1, 'Title is required'),
  body: z.string().optional(),
  tags: z.array(z.string()).optional(),
  related: z.array(z.string()).optional(),
  url: z.string().url().optional(),
  resource_type: z
    .enum(['tool', 'library', 'api', 'dataset', 'reference', 'article', 'repo', 'other'])
    .optional(),
  description: z.string().optional(),
});

export type CreateResourceNodeBody = z.infer<typeof createResourceNodeBodySchema>;

export const codeHighlightBodySchema = z.object({
  code: z.string(),
  language: z.string().optional(),
});

export type CodeHighlightBody = z.infer<typeof codeHighlightBodySchema>;

export const mediaQuerySchema = z.object({
  path: z.string().min(1),
});

export type MediaQuery = z.infer<typeof mediaQuerySchema>;

export const updateVaultNodeBodySchema = z
  .object({
    tags: z.array(z.string()).optional(),
    status: z.enum(['seed', 'growing', 'mature', 'archived']).optional(),
  })
  .refine((body) => body.tags !== undefined || body.status !== undefined, {
    message: 'Provide tags and/or status to update.',
  });

export type UpdateVaultNodeBody = z.infer<typeof updateVaultNodeBodySchema>;

export const batchUpdateVaultNodesBodySchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1),
    tags: z.array(z.string()).optional(),
    status: z.enum(['seed', 'growing', 'mature', 'archived']).optional(),
  })
  .refine((body) => body.tags !== undefined || body.status !== undefined, {
    message: 'Provide tags and/or status to update.',
  });

export type BatchUpdateVaultNodesBody = z.infer<typeof batchUpdateVaultNodesBodySchema>;

export const deleteRunQuerySchema = z.object({
  deleteProduced: z.enum(['true', 'false']).optional(),
});

export type DeleteRunQuery = z.infer<typeof deleteRunQuerySchema>;

export const deleteRunsPreviewBodySchema = z.object({
  ids: z.array(z.string().min(1)).min(1),
});

export type DeleteRunsPreviewBody = z.infer<typeof deleteRunsPreviewBodySchema>;

export const promoteCanonicalIdeaBodySchema = z.object({
  candidateId: z.string().min(1),
});

export type PromoteCanonicalIdeaBody = z.infer<typeof promoteCanonicalIdeaBodySchema>;

export const updateSourceProfilesBodySchema = z.object({
  profiles: z.array(SourceProfileSchema),
});

export type UpdateSourceProfilesBody = z.infer<typeof updateSourceProfilesBodySchema>;

export const vaultLoginBodySchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

export type VaultLoginBody = z.infer<typeof vaultLoginBodySchema>;

export const cleanRecentBodySchema = z.object({
  hours: z.number().finite().positive().max(8760),
});

export type CleanRecentBody = z.infer<typeof cleanRecentBodySchema>;

export const resolveCanonicalIdeaConflictBodySchema = z.object({
  keep: z.enum(['existing', 'incoming']),
  incomingCanonicalIdeaIds: z.array(z.string().min(1)),
  existingCanonicalIdeaIds: z.array(z.string().min(1)),
  pendingCoverage: TranscriptCanonicalCoverageSchema.optional(),
});

export type ResolveCanonicalIdeaConflictBody = z.infer<typeof resolveCanonicalIdeaConflictBodySchema>;

export const createWikiDraftBodySchema = CreateWikiDraftRequestSchema;
export type CreateWikiDraftBody = z.infer<typeof createWikiDraftBodySchema>;

export const wikiResearchBodySchema = WikiResearchRequestSchema;

export const editWikiDraftBodySchema = z
  .object({
    title: z.string().min(1).optional(),
    summary: z.string().min(1).optional(),
  })
  .refine((body) => body.title !== undefined || body.summary !== undefined, {
    message: 'Provide a title and/or summary to update.',
  });
export type EditWikiDraftBody = z.infer<typeof editWikiDraftBodySchema>;
