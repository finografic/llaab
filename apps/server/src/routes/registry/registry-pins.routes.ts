import type { AppCtx, AppCtxJson } from '../../types/app.types.js';
import type { PinBody } from './registry.schema.js';
import type { PinnedPackage } from '@llaab/schemas';

import { fetchPackageMeta } from './registry-npm.routes.js';
import { readPins, writePins } from './registry-pins.store.js';
import {
  packageProjectionStatus,
  projectPinnedPackageResource,
  readRegistryResourceProjectionIndex,
} from './registry-resource-projection.js';

export const listPins = {
  path: '/pins' as const,
  handler: async (c: AppCtx) => {
    const pins = await readPins();
    let dirty = false;

    const next = await Promise.all(
      pins.map(async (pin) => {
        if (pin.meta.typesStatus != null) return pin;
        try {
          const meta = await fetchPackageMeta(pin.name);
          dirty = true;
          return { ...pin, meta };
        } catch {
          dirty = true;
          return { ...pin, meta: { ...pin.meta, typesStatus: 'none' as const } };
        }
      }),
    );

    if (dirty) await writePins(next);

    const projections = await readRegistryResourceProjectionIndex();
    const pinsWithResources = next.map((pin) => ({
      ...pin,
      resource: packageProjectionStatus(projections, pin.name),
    }));
    return c.json({ pins: pinsWithResources });
  },
};

export const pinPackage = {
  path: '/pins' as const,
  handler: async (c: AppCtxJson<PinBody>) => {
    const { name } = c.req.valid('json');
    const pins = await readPins();

    const existing = pins.find((p) => p.name === name);
    if (existing) {
      const resource = await projectPinnedPackageResource(existing);
      return c.json({ error: 'Already pinned', pin: existing, resource }, 409);
    }

    try {
      const meta = await fetchPackageMeta(name);
      const pin: PinnedPackage = { name, pinnedAt: new Date().toISOString(), meta };
      await writePins([...pins, pin]);
      const resource = await projectPinnedPackageResource(pin);
      return c.json({ pin, resource }, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch package';
      return c.json({ error: message }, 502);
    }
  },
};

export const unpinPackage = {
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
