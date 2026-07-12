import { z } from 'zod';

export const listKnowledgeWikisQuerySchema = z.object({
  lifecycle: z.enum(['seed', 'growing', 'mature']).optional(),
  tag: z.string().min(1).optional(),
  verification: z.enum(['source-backed', 'corroborated', 'contested']).optional(),
  q: z.string().min(1).optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
