import type { Context } from 'hono';

export interface SessionPayload {
  authenticated: boolean;
  createdAt: number;
}

/** Hono context type used across all route handlers. */
export interface AppEnv {
  Variables: {
    session?: SessionPayload;
  };
}

/** Alias for a Hono app instance with the shared env. */
export type AppCtx = Context<AppEnv>;

/** Context type for handlers that follow a JSON body validator. */
export type AppCtxJson<T> = Context<AppEnv, string, { in: { json: T }; out: { json: T } }>;

/** Context type for handlers that follow a query string validator. */
export type AppCtxQuery<T> = Context<AppEnv, string, { in: { query: T }; out: { query: T } }>;
