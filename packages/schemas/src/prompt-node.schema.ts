import { z } from 'zod';

import { BaseNodeSchema } from './base-node.schema.js';

export const PromptNodeSchema = BaseNodeSchema.extend({
  type: z.literal('prompt'),
  variables: z.array(z.string()).default([]),
  modelHint: z.string().optional(),
  outputSchema: z.string().optional(),
});

export type PromptNode = z.infer<typeof PromptNodeSchema>;
