import type { AppCtx, AppCtxJson } from '../../types/app.types.js';
import type { SetUiStateBody } from './ui-state.schema.js';

import { getUiState, setUiState } from './ui-state.store.js';

export const get = {
  path: '/:key' as const,
  handler: async (c: AppCtx) => {
    const key = c.req.param('key');
    if (!key) return c.json({ error: 'Key is required.' }, 400);

    return c.json({ key, value: getUiState(key) });
  },
};

export const set = {
  path: '/:key' as const,
  handler: async (c: AppCtxJson<SetUiStateBody>) => {
    const key = c.req.param('key');
    if (!key) return c.json({ error: 'Key is required.' }, 400);

    const body = c.req.valid('json');
    const value = setUiState(key, body.value);
    return c.json({ key, value });
  },
};
