import { z } from 'zod';

export const ingestYouTubeBodySchema = z.object({
  url: z.string().url('Must be a valid URL'),
  title: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export type IngestYouTubeBody = z.infer<typeof ingestYouTubeBodySchema>;
