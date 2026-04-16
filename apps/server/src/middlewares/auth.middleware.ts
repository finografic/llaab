import { StatusCodes } from 'http-status-codes';
import type { MiddlewareHandler } from 'hono';

/**
 * X-API-Key guard. Reads `SERVER_API_KEY` from `process.env`. If the env var is not set, auth is disabled
 * (dev convenience — always allow).
 */
export const auth: MiddlewareHandler = async (c, next) => {
  const requiredKey = process.env['SERVER_API_KEY'];

  if (!requiredKey) {
    await next();
    return;
  }

  const providedKey = c.req.header('X-API-Key');
  if (providedKey !== requiredKey) {
    return c.json({ error: 'Unauthorized' }, StatusCodes.UNAUTHORIZED);
  }

  await next();
};
