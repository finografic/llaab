import { z } from 'zod';

import { BaseNodeSchema } from './base-node.schema.js';
import { NodeIdSchema } from './primitives.schema.js';

export const IdeaNodeSchema = BaseNodeSchema.extend({
  type: z.literal('idea'),
  origin: z.enum(['manual', 'extracted', 'generated']).default('manual'),
  sourceId: NodeIdSchema.optional(),
});

export type IdeaNode = z.infer<typeof IdeaNodeSchema>;
