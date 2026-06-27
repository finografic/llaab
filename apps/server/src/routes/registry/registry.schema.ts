import { z } from 'zod';

export const searchQuerySchema = z.object({
  q: z.string().min(1),
  size: z
    .string()
    .optional()
    .transform((v) => (v ? Number.parseInt(v, 10) : 25)),
  from: z
    .string()
    .optional()
    .transform((v) => (v ? Number.parseInt(v, 10) : 0)),
});

export const pinBodySchema = z.object({
  name: z.string().min(1),
});

export type SearchQuery = z.infer<typeof searchQuerySchema>;
export type PinBody = z.infer<typeof pinBodySchema>;
