import { z } from 'zod';

export const updateCronRecipeBodySchema = z.object({
  enabled: z.boolean(),
});

export type UpdateCronRecipeBody = z.infer<typeof updateCronRecipeBodySchema>;
