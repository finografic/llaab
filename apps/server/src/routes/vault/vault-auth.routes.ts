import { deleteCookie, setCookie } from 'hono/cookie';
import type { AppCtx, AppCtxJson } from '../../types/app.types.js';
import type { VaultLoginBody } from './vault.schema.js';

import {
  getVaultPassword,
  isVaultAuthEnabled,
  isVaultSessionValid,
  VAULT_COOKIE_MAX_AGE,
  VAULT_COOKIE_NAME,
} from '../../lib/vault-auth.js';

export const vaultAuthLogin = {
  path: '/auth/login' as const,
  handler: async (c: AppCtxJson<VaultLoginBody>) => {
    if (!isVaultAuthEnabled()) {
      return c.json({ ok: true, authRequired: false });
    }

    const { password } = c.req.valid('json');
    const expected = getVaultPassword();
    if (expected === null || password !== expected) {
      return c.json({ ok: false, error: 'Incorrect password.' }, 401);
    }

    setCookie(c, VAULT_COOKIE_NAME, password, {
      path: '/',
      maxAge: VAULT_COOKIE_MAX_AGE,
      httpOnly: true,
      sameSite: 'Lax',
    });

    return c.json({ ok: true, authRequired: true });
  },
};

export const vaultAuthLogout = {
  path: '/auth/logout' as const,
  handler: (c: AppCtx) => {
    deleteCookie(c, VAULT_COOKIE_NAME, { path: '/' });
    return c.json({ ok: true });
  },
};

export const vaultAuthSession = {
  path: '/auth/session' as const,
  handler: (c: AppCtx) => {
    if (!isVaultAuthEnabled()) {
      return c.json({ ok: true, authRequired: false });
    }

    if (!isVaultSessionValid(c)) {
      return c.json({ ok: false, authRequired: true }, 401);
    }

    return c.json({ ok: true, authRequired: true });
  },
};
