import { z } from 'zod';

export const runAgentBodySchema = z.object({
  nodeId: z.string().optional(),
  force: z.boolean().optional(),
});

export type RunAgentBody = z.infer<typeof runAgentBodySchema>;
