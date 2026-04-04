import { z } from 'zod';

import { BaseNodeSchema } from './base-node.schema.js';

export const SourceKindSchema = z.enum(['person', 'channel', 'repo', 'publication', 'organization', 'other']);

export const SourceNodeSchema = BaseNodeSchema.extend({
  type: z.literal('source'),
  sourceKind: SourceKindSchema.default('other'),
  url: z.string().url().optional(),
  platforms: z.array(z.string()).default([]),
  follow: z.boolean().default(false),
});

export type SourceNode = z.infer<typeof SourceNodeSchema>;
export type SourceKind = z.infer<typeof SourceKindSchema>;
