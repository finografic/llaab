import { z } from 'zod';

import { NodeIdSchema, TimestampSchema } from './primitives.schema.js';

export const RelationshipTypeSchema = z.enum([
  'uses',
  'produces',
  'derivedFrom',
  'refines',
  'dependsOn',
  'authoredBy',
  'inputTo',
  'outputOf',
  'relatedTo',
]);

export const RelationshipSchema = z.object({
  from: NodeIdSchema,
  to: NodeIdSchema,
  type: RelationshipTypeSchema,
  createdAt: TimestampSchema,
  note: z.string().optional(),
});

export type Relationship = z.infer<typeof RelationshipSchema>;
export type RelationshipType = z.infer<typeof RelationshipTypeSchema>;
