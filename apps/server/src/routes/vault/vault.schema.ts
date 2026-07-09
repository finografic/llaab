import { NodeTypeSchema, SourceProfileSchema, TranscriptCanonicalCoverageSchema } from '@llaab/schemas';
import { z } from 'zod';

export const listNodesQuerySchema = z.object({
  type: NodeTypeSchema.optional(),
  status: z.enum(['seed', 'growing', 'mature', 'archived']).optional(),
  tags: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').map((t) => t.trim()) : undefined)),
  search: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseInt(val, 10) : undefined)),
});

export type ListNodesQuery = z.infer<typeof listNodesQuerySchema>;

export const createNodeBodySchema = z.object({
  type: z.literal('idea'),
  title: z.string().min(1, 'Title is required'),
  body: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateNodeBody = z.infer<typeof createNodeBodySchema>;

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
