import { z } from 'zod';

import { BaseNodeSchema } from './base-node.schema.js';
import { NodeIdSchema, RunStatusSchema, TimestampSchema } from './primitives.schema.js';

export const RunNodeSchema = BaseNodeSchema.extend({
  type: z.literal('run'),
  skillId: NodeIdSchema.optional(),
  runStatus: RunStatusSchema.default('pending'),
  inputSummary: z.string().optional(),
  outputSummary: z.string().optional(),
  producedNodeIds: z.array(NodeIdSchema).default([]),
  modelUsed: z.string().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
  startedAt: TimestampSchema.optional(),
  completedAt: TimestampSchema.optional(),
});

export type RunNode = z.infer<typeof RunNodeSchema>;
