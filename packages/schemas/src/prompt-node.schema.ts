import { z } from 'zod';

import { BaseNodeSchema } from './base-node.schema.js';

export const PromptNodeSchema = BaseNodeSchema.extend({
  type: z.literal('prompt'),
  variables: z.array(z.string()).default([]),
  model_hint: z.string().optional(),
  output_schema: z.string().optional(),
});

export type PromptNode = z.infer<typeof PromptNodeSchema>;
