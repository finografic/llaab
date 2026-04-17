import { NodeTypeSchema } from '@llaab/schemas';
import { z } from 'zod';

export const listNodesQuerySchema = z.object({
  type: NodeTypeSchema.optional(),
  status: z.enum(['seed', 'growing', 'mature', 'archived']).optional(),
  tags: z
    .string()
    .optional()
    .transform((val) => (val ? val.split(',').map((t) => t.trim()) : undefined)),
  search: z.string().optional(),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? Number.parseInt(val, 10) : undefined)),
});

export type ListNodesQuery = z.infer<typeof listNodesQuerySchema>;

export const createNodeBodySchema = z.object({
  type: z.literal('idea'),
  title: z.string().min(1, 'Title is required'),
  body: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type CreateNodeBody = z.infer<typeof createNodeBodySchema>;
