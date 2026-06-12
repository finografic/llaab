import { StatusCodes } from 'http-status-codes';
import type { MiddlewareHandler } from 'hono';

import { isVaultSessionValid } from '../lib/vault-auth.js';

/** Require a valid `vault_key` session cookie before vault mutations and reads. */
export const requireVaultSession: MiddlewareHandler = async (c, next) => {
  if (!isVaultSessionValid(c)) {
    return c.json({ error: 'Vault session required.' }, StatusCodes.UNAUTHORIZED);
  }

  await next();
};
