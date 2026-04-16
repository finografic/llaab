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
