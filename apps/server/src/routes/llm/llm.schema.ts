import { z } from 'zod';

export const llmTaskSchema = z.enum([
  'route',
  'format',
  'extract',
  'consolidate',
  'code',
  'reason',
  'reason-plus',
  'vision',
  'speech',
]);

export const llmTierSchema = z.enum(['local-small', 'local-mid', 'local-strong', 'remote']);

export const llmProviderSchema = z.enum(['ollama', 'anthropic', 'lmstudio', 'opencode']);

export const completeLlmBodySchema = z.object({
  task: llmTaskSchema,
  prompt: z.string().min(1),
  system: z.string().optional(),
  model: z.string().optional(),
  maxTokens: z.number().int().positive().optional(),
});

export const updateLlmRouteBodySchema = z.object({
  task: llmTaskSchema,
  model: z.string().min(1),
  tier: llmTierSchema,
  provider: llmProviderSchema,
});

export type CompleteLlmBody = z.infer<typeof completeLlmBodySchema>;
export type UpdateLlmRouteBody = z.infer<typeof updateLlmRouteBodySchema>;
