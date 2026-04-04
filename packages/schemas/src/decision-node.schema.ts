import { z } from 'zod';

import { BaseNodeSchema } from './base-node.schema.js';

export const DecisionNodeSchema = BaseNodeSchema.extend({
  type: z.literal('decision'),
  context: z.string().default(''),
  decision: z.string().default(''),
  rationale: z.string().default(''),
  alternatives: z.array(z.string()).default([]),
  consequences: z.array(z.string()).default([]),
});

export type DecisionNode = z.infer<typeof DecisionNodeSchema>;
