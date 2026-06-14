import { z } from 'zod';

import { BaseNodeSchema } from './base-node.schema.js';
import { NodeIdSchema, RunStatusSchema, TimestampSchema } from './primitives.schema.js';

const RunStageStatusSchema = z.enum(['pending', 'completed', 'failed']);

const RunStageSchema = z.object({
  name: z.string().min(1),
  status: RunStageStatusSchema,
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  error: z.string().optional(),
});

const RunDecisionTypeSchema = z.enum(['accept', 'retry', 'reject', 'downgrade']);

const RunDecisionSchema = z.object({
  type: RunDecisionTypeSchema,
  reason: z.string().min(1),
});

export const RunEventLevelSchema = z.enum(['info', 'success', 'warning', 'error']);

export const RunEventSchema = z.object({
  id: z.string().min(1),
  at: TimestampSchema,
  level: RunEventLevelSchema,
  message: z.string().min(1),
  node_ids: z.array(NodeIdSchema).optional(),
  href: z.string().optional(),
});

const RunLlmTraceSchema = z.object({
  model: z.string().optional(),
  provider: z.string().optional(),
  duration_ms: z.number().int().nonnegative().optional(),
  prompt_tokens: z.number().int().nonnegative().optional(),
  completion_tokens: z.number().int().nonnegative().optional(),
  raw_output: z.string().optional(),
  parsed: z.boolean().optional(),
});

export const RunNodeSchema = BaseNodeSchema.extend({
  type: z.literal('run'),
  skill_id: NodeIdSchema.optional(),
  run_status: RunStatusSchema.default('pending'),
  input_summary: z.string().optional(),
  output_summary: z.string().optional(),
  produced_node_ids: z.array(NodeIdSchema).default([]),
  stages: z.array(RunStageSchema).default([]),
  decisions: z.array(RunDecisionSchema).default([]),
  events: z.array(RunEventSchema).default([]),
  llm: RunLlmTraceSchema.optional(),
  model_used: z.string().optional(),
  duration_ms: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
  started_at: TimestampSchema.optional(),
  completed_at: TimestampSchema.optional(),
  monitor_dismissed_at: TimestampSchema.optional(),
});

export type RunNode = z.infer<typeof RunNodeSchema>;
export type RunEvent = z.infer<typeof RunEventSchema>;
