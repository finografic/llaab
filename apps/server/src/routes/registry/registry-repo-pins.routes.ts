import type { AppCtx, AppCtxJson } from '../../types/app.types.js';
import type { RepoPinBody } from './registry.schema.js';
import type { PinnedRepository } from '@llaab/schemas';

import { fetchRepoMeta } from './registry-github.routes.js';
import { readRepoPins, writeRepoPins } from './registry-repo-pins.store.js';

export const listRepoPins = {
  path: '/repo-pins' as const,
  handler: async (c: AppCtx) => {
    const pins = await readRepoPins();
    return c.json({ pins });
  },
};

export const pinRepository = {
  path: '/repo-pins' as const,
  handler: async (c: AppCtxJson<RepoPinBody>) => {
    const { fullName } = c.req.valid('json');
    const pins = await readRepoPins();

    if (pins.some((p) => p.fullName === fullName)) {
      return c.json({ error: 'Already pinned' }, 409);
    }

    try {
      const meta = await fetchRepoMeta(fullName);
      const pin: PinnedRepository = { fullName, pinnedAt: new Date().toISOString(), meta };
      await writeRepoPins([...pins, pin]);
      return c.json({ pin }, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch repository';
      return c.json({ error: message }, 502);
    }
  },
};

export const unpinRepository = {
  path: '/repo-pins/:owner/:repo' as const,
  handler: async (c: AppCtx) => {
    const owner = decodeURIComponent(c.req.param('owner') ?? '');
    const repo = decodeURIComponent(c.req.param('repo') ?? '');
    const fullName = `${owner}/${repo}`;
    const pins = await readRepoPins();
    const next = pins.filter((p) => p.fullName !== fullName);

    if (next.length === pins.length) {
      return c.json({ error: 'Not pinned' }, 404);
    }

    await writeRepoPins(next);
    return c.json({ success: true });
  },
};
