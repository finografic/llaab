import { z } from 'zod';

export const completeLlmBodySchema = z.object({
  task: z.enum(['format', 'extract', 'code', 'reason']),
  prompt: z.string().min(1),
  system: z.string().optional(),
  model: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
});

export type CompleteLlmBody = z.infer<typeof completeLlmBodySchema>;
