import { z } from 'zod';

import { BaseNodeSchema } from './base-node.schema.js';
import { NodeIdSchema } from './primitives.schema.js';

export const ResourceTypeSchema = z.enum([
  'tool',
  'package',
  'library',
  'api',
  'dataset',
  'reference',
  'article',
  'repo',
  'other',
]);

export const ResourceNodeSchema = BaseNodeSchema.extend({
  type: z.literal('resource'),
  source_id: NodeIdSchema.optional(),
  url: z.string().url().optional(),
  resource_type: ResourceTypeSchema.default('reference'),
  description: z.string().optional(),
});

export type ResourceNode = z.infer<typeof ResourceNodeSchema>;
export type ResourceType = z.infer<typeof ResourceTypeSchema>;
