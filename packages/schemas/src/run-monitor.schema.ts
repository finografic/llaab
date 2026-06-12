import { z } from 'zod';

import { NodeIdSchema, RunStatusSchema, TimestampSchema } from './primitives.schema.js';

export const RunMonitorStepStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'skipped']);

export const RunMonitorStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: RunMonitorStepStatusSchema,
  detail: z.string().optional(),
});

export const RunMonitorLinkSchema = z.object({
  label: z.string().min(1),
  href: z.string().min(1),
});

export const RunMonitorItemSchema = z.object({
  id: NodeIdSchema,
  title: z.string().min(1),
  status: RunStatusSchema,
  skill_id: NodeIdSchema.optional(),
  started_at: TimestampSchema.optional(),
  completed_at: TimestampSchema.optional(),
  duration_ms: z.number().int().nonnegative().optional(),
  input_summary: z.string().optional(),
  output_summary: z.string().optional(),
  error: z.string().optional(),
  produced_node_count: z.number().int().nonnegative(),
  primary_link: RunMonitorLinkSchema.optional(),
  run_link: RunMonitorLinkSchema,
  steps: z.array(RunMonitorStepSchema),
  model: z.string().optional(),
  provider: z.string().optional(),
  prompt_tokens: z.number().int().nonnegative().optional(),
  completion_tokens: z.number().int().nonnegative().optional(),
});

export const RunMonitorResponseSchema = z.object({
  active: z.array(RunMonitorItemSchema),
  recent: z.array(RunMonitorItemSchema),
});

export type RunMonitorStep = z.infer<typeof RunMonitorStepSchema>;
export type RunMonitorItem = z.infer<typeof RunMonitorItemSchema>;
export type RunMonitorResponse = z.infer<typeof RunMonitorResponseSchema>;
