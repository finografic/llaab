import { StatusCodes } from 'http-status-codes';
import type { AppCtx, AppCtxJson } from '../../types/app.types.js';
import type { AuthLoginBody } from './auth.schema.js';

import { getAppPassword } from '../../config/auth.config.js';
import {
  clearSessionCookie,
  constantTimeStringEqual,
  createSessionToken,
  getSessionToken,
  setSessionCookie,
  verifySessionToken,
} from '../../lib/session.js';

export const login = {
  path: '/login' as const,
  handler: async (c: AppCtxJson<AuthLoginBody>) => {
    const expectedPassword = getAppPassword();
    if (!expectedPassword) {
      return c.json(
        { ok: false, error: 'No app password configured on server.' },
        StatusCodes.INTERNAL_SERVER_ERROR,
      );
    }

    const { password } = c.req.valid('json');
    const matches = await constantTimeStringEqual(password, expectedPassword);
    if (!matches) {
      return c.json({ ok: false, error: 'Invalid password.' }, StatusCodes.UNAUTHORIZED);
    }

    const token = await createSessionToken();
    setSessionCookie(c, token);
    return c.json({ ok: true });
  },
};

export const logout = {
  path: '/logout' as const,
  handler: (c: AppCtx) => {
    clearSessionCookie(c);
    return c.json({ ok: true });
  },
};

export const session = {
  path: '/session' as const,
  handler: async (c: AppCtx) => {
    if (!getAppPassword()) {
      return c.json({ authenticated: true, authRequired: false });
    }

    const token = getSessionToken(c);
    const payload = token ? await verifySessionToken(token) : null;
    return c.json({
      authenticated: payload?.authenticated === true,
      authRequired: true,
    });
  },
};
