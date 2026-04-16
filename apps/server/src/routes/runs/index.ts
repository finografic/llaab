import { listNodes } from '@llaab/core';
import type { RunNode } from '@llaab/schemas';

import { createRouter } from '../../lib/create-app.js';

export const runsRouter = createRouter()
  .get('/', async (c) => {
    const all = await listNodes({ type: 'run' });
    const runs = (all as RunNode[]).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return c.json({ runs });
  })
  .get('/:id', async (c) => {
    const { id } = c.req.param();
    const all = await listNodes({ type: 'run' });
    const run = (all as RunNode[]).find((r) => r.id === id);
    if (!run) return c.json({ error: 'Run not found' }, 404);
    return c.json({ run });
  });
