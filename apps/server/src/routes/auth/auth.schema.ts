import { z } from 'zod';

export const authLoginBodySchema = z.object({
  password: z.string().min(1),
});

export type AuthLoginBody = z.infer<typeof authLoginBodySchema>;
