import { z } from 'zod';

import { BaseNodeSchema } from './base-node.schema.js';

export const InstructionNodeSchema = BaseNodeSchema.extend({
  type: z.literal('instruction'),
  scope: z.string().optional(),
});

export type InstructionNode = z.infer<typeof InstructionNodeSchema>;
