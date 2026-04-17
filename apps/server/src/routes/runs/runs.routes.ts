import { listNodes } from '@llaab/core';
import type { AppCtx } from '../../types/app.types.js';
import type { RunNode } from '@llaab/schemas';

export const list = {
  path: '/' as const,
  handler: async (c: AppCtx) => {
    const all = await listNodes({ type: 'run' });
    const runs = (all as RunNode[]).sort((a, b) => b.created_at.localeCompare(a.created_at));
    return c.json({ runs });
  },
};

export const detail = {
  path: '/:id' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    const all = await listNodes({ type: 'run' });
    const run = (all as RunNode[]).find((r) => r.id === id);
    if (!run) return c.json({ error: 'Run not found' }, 404);
    return c.json({ run });
  },
};
