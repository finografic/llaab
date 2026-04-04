import { z } from 'zod';

export const NodeIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and hyphens only');

export const NodeTypeSchema = z.enum([
  'idea',
  'skill',
  'prompt',
  'instruction',
  'transcript',
  'resource',
  'source',
  'decision',
  'run',
]);

export const NodeStatusSchema = z.enum(['seed', 'growing', 'mature', 'archived']);

export const RunStatusSchema = z.enum(['pending', 'running', 'completed', 'failed', 'cancelled']);

export const TimestampSchema = z
  .string()
  .min(1)
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Must be a valid ISO timestamp');

export type NodeId = z.infer<typeof NodeIdSchema>;
export type NodeType = z.infer<typeof NodeTypeSchema>;
export type NodeStatus = z.infer<typeof NodeStatusSchema>;
export type RunStatus = z.infer<typeof RunStatusSchema>;
