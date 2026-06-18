import { z } from 'zod';

import { NodeTypeSchema } from './primitives.schema.js';

export const VaultGitFileStatusSchema = z.enum([
  'added',
  'deleted',
  'ignored',
  'modified',
  'renamed',
  'untracked',
]);

export const VaultGitStatusEntrySchema = z.object({
  path: z.string().min(1),
  status: VaultGitFileStatusSchema,
  nodeType: NodeTypeSchema.optional(),
});

export const VaultGitStatusResponseSchema = z.object({
  entries: z.array(VaultGitStatusEntrySchema),
  totalCount: z.number().int().nonnegative(),
  countsByType: z.record(z.string(), z.number().int().nonnegative()),
  commitMessage: z.string(),
});

export const VaultGitCommitResponseSchema = z.object({
  committedCount: z.number().int().nonnegative(),
  commitMessage: z.string(),
  sha: z.string().optional(),
});

export const VaultGitResetResponseSchema = z.object({
  resetCount: z.number().int().nonnegative(),
});

export type VaultGitFileStatus = z.infer<typeof VaultGitFileStatusSchema>;
export type VaultGitStatusEntry = z.infer<typeof VaultGitStatusEntrySchema>;
export type VaultGitStatusResponse = z.infer<typeof VaultGitStatusResponseSchema>;
export type VaultGitCommitResponse = z.infer<typeof VaultGitCommitResponseSchema>;
export type VaultGitResetResponse = z.infer<typeof VaultGitResetResponseSchema>;
