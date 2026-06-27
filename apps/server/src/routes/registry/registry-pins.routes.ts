import type { AppCtx, AppCtxJson } from '../../types/app.types.js';
import type { PinBody } from './registry.schema.js';
import type { PinnedLibrary } from '@llaab/schemas';

import { fetchPackageMeta } from './registry-npm.routes.js';
import { readPins, writePins } from './registry-pins.store.js';

export const listPins = {
  path: '/pins' as const,
  handler: async (c: AppCtx) => {
    const pins = await readPins();
    return c.json({ pins });
  },
};

export const pinLibrary = {
  path: '/pins' as const,
  handler: async (c: AppCtxJson<PinBody>) => {
    const { name } = c.req.valid('json');
    const pins = await readPins();

    if (pins.some((p) => p.name === name)) {
      return c.json({ error: 'Already pinned' }, 409);
    }

    try {
      const meta = await fetchPackageMeta(name);
      const pin: PinnedLibrary = { name, pinnedAt: new Date().toISOString(), meta };
      await writePins([...pins, pin]);
      return c.json({ pin }, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch package';
      return c.json({ error: message }, 502);
    }
  },
};

export const unpinLibrary = {
  path: '/pins/:name' as const,
  handler: async (c: AppCtx) => {
    const name = decodeURIComponent(c.req.param('name') ?? '');
    const pins = await readPins();
    const next = pins.filter((p) => p.name !== name);

    if (next.length === pins.length) {
      return c.json({ error: 'Not pinned' }, 404);
    }

    await writePins(next);
    return c.json({ success: true });
  },
};
