import { z } from 'zod';

export const cronRiskSchema = z.enum(['low', 'medium', 'high']);

export const cronRecipeWriteBodySchema = z.object({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  risk: cronRiskSchema,
  cronExpression: z.string().trim().min(1),
  scriptId: z.string().trim().min(1),
});

export const createCronRecipeBodySchema = cronRecipeWriteBodySchema.extend({
  id: z.string().trim().min(1).optional(),
});

export const updateCronRecipeBodySchema = z.object({
  enabled: z.boolean().optional(),
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  risk: cronRiskSchema.optional(),
  cronExpression: z.string().trim().min(1).optional(),
  scriptId: z.string().trim().min(1).optional(),
});

export type CreateCronRecipeBody = z.infer<typeof createCronRecipeBodySchema>;
export type UpdateCronRecipeBody = z.infer<typeof updateCronRecipeBodySchema>;
