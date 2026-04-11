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

const RunLlmTraceSchema = z.object({
  model: z.string().optional(),
  rawOutput: z.string().optional(),
  parsed: z.boolean().optional(),
});

export const RunNodeSchema = BaseNodeSchema.extend({
  type: z.literal('run'),
  skillId: NodeIdSchema.optional(),
  runStatus: RunStatusSchema.default('pending'),
  inputSummary: z.string().optional(),
  outputSummary: z.string().optional(),
  producedNodeIds: z.array(NodeIdSchema).default([]),
  stages: z.array(RunStageSchema).default([]),
  decisions: z.array(RunDecisionSchema).default([]),
  llm: RunLlmTraceSchema.optional(),
  modelUsed: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
  startedAt: TimestampSchema.optional(),
  completedAt: TimestampSchema.optional(),
});

export type RunNode = z.infer<typeof RunNodeSchema>;
