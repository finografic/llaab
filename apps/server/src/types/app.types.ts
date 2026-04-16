import type { Hono } from 'hono';

/** Hono context type used across all route handlers. */
export type AppEnv = {
  Variables: Record<string, never>;
};

/** Alias for a Hono app instance with the shared env. */
export type AppInstance = Hono<AppEnv>;
