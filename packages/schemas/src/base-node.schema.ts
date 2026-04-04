import { z } from 'zod';

import { NodeIdSchema, NodeStatusSchema, NodeTypeSchema, TimestampSchema } from './primitives.schema.js';

export const BaseNodeSchema = z.object({
  id: NodeIdSchema,
  type: NodeTypeSchema,
  title: z.string().min(1),
  tags: z.array(z.string()).default([]),
  related: z.array(NodeIdSchema).default([]),
  createdAt: TimestampSchema,
  updatedAt: TimestampSchema.optional(),
  status: NodeStatusSchema.default('seed'),
  body: z.string().default(''),
});

export type BaseNode = z.infer<typeof BaseNodeSchema>;
