import { z } from 'zod';

export const setUiStateBodySchema = z.object({
  value: z.unknown(),
});

export type SetUiStateBody = z.infer<typeof setUiStateBodySchema>;
