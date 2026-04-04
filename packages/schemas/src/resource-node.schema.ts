import { z } from 'zod';

import { BaseNodeSchema } from './base-node.schema.js';

export const ResourceTypeSchema = z.enum([
  'tool',
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
  url: z.string().url().optional(),
  resourceType: ResourceTypeSchema.default('reference'),
  description: z.string().optional(),
});

export type ResourceNode = z.infer<typeof ResourceNodeSchema>;
export type ResourceType = z.infer<typeof ResourceTypeSchema>;
