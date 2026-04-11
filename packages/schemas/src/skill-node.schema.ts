import { z } from 'zod';

import { BaseNodeSchema } from './base-node.schema.js';
import { NodeIdSchema } from './primitives.schema.js';

export const SkillNodeSchema = BaseNodeSchema.extend({
  type: z.literal('skill'),
  inputs: z.array(z.string()).default([]),
  outputs: z.array(z.string()).default([]),
  tools: z.array(z.string()).default([]),
  version: z.string().optional(),
  sourceId: NodeIdSchema.optional(),
  derivedFromIds: z.array(NodeIdSchema).default([]),
  parentSkillId: NodeIdSchema.optional(),
  generation: z.number().int().nonnegative().default(0),
});

export type SkillNode = z.infer<typeof SkillNodeSchema>;
