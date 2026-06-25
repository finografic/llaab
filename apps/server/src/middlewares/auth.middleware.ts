import { StatusCodes } from 'http-status-codes';
import type { MiddlewareHandler } from 'hono';

import { getApiKey, getAppPassword } from '../config/auth.config.js';
import { getSessionToken, verifySessionToken } from '../lib/session.js';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Hydrate the optional browser session from the signed app cookie.
 */
export const sessionMiddleware: MiddlewareHandler = async (c, next) => {
  const token = getSessionToken(c);
  if (token) {
    const session = await verifySessionToken(token);
    if (session) {
      c.set('session', session);
    }
  }

  await next();
};

/**
 * Require an API key or browser session for mutating API requests.
 *
 * Reads `LLAAB_API_KEY`. If neither an API key nor `LLAAB_PASSWORD` is configured, writes are
 * allowed for local development.
 */
export const requireAuth: MiddlewareHandler = async (c, next) => {
  if (c.req.path.startsWith('/api/auth/')) {
    await next();
    return;
  }

  if (!MUTATING_METHODS.has(c.req.method)) {
    await next();
    return;
  }

  const requiredKey = getApiKey();
  const password = getAppPassword();

  if (!requiredKey && !password) {
    await next();
    return;
  }

  const session = c.get('session');
  if (session?.authenticated === true) {
    await next();
    return;
  }

  const providedKey = c.req.header('X-API-Key');
  if (requiredKey && providedKey === requiredKey) {
    await next();
    return;
  }

  return c.json({ error: 'Unauthorized' }, StatusCodes.UNAUTHORIZED);
};

export const auth = requireAuth;

/** API-key-only guard for non-browser consumers when a route needs it explicitly. */
export const requireApiKey: MiddlewareHandler = async (c, next) => {
  const requiredKey = getApiKey();
  if (!requiredKey) {
    await next();
    return;
  }

  const providedKey = c.req.header('X-API-Key');
  if (providedKey === requiredKey) {
    await next();
    return;
  }

  return c.json({ error: 'Unauthorized' }, StatusCodes.UNAUTHORIZED);
};
