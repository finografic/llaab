import type { AppCtx, AppCtxJson } from '../../types/app.types.js';
import type { RepoPinBody } from './registry.schema.js';
import type { PinnedRepository, RegistryPinProvenance } from '@llaab/schemas';

import { fetchRepoMeta } from './registry-github.routes.js';
import { readRepoPins, writeRepoPins } from './registry-repo-pins.store.js';
import {
  projectPinnedRepositoryResource,
  readRegistryResourceProjectionIndex,
  repoProjectionStatus,
} from './registry-resource-projection.js';

export const listRepoPins = {
  path: '/repo-pins' as const,
  handler: async (c: AppCtx) => {
    const pins = await readRepoPins();
    const projections = await readRegistryResourceProjectionIndex();
    const pinsWithResources = pins.map((pin) => ({
      ...pin,
      resource: repoProjectionStatus(projections, pin.fullName),
    }));
    return c.json({ pins: pinsWithResources });
  },
};

export const pinRepository = {
  path: '/repo-pins' as const,
  handler: async (c: AppCtxJson<RepoPinBody>) => {
    const { fullName, provenance } = c.req.valid('json');
    const pins = await readRepoPins();

    const existing = pins.find((p) => p.fullName === fullName);
    if (existing) {
      const nextPin = mergeRepositoryPinProvenance(existing, provenance);
      if (nextPin !== existing) {
        await writeRepoPins(pins.map((pin) => (pin.fullName === fullName ? nextPin : pin)));
      }
      const resource = await projectPinnedRepositoryResource(nextPin);
      return c.json({ error: 'Already pinned', pin: nextPin, resource }, 409);
    }

    try {
      const meta = await fetchRepoMeta(fullName);
      const pin: PinnedRepository = {
        fullName,
        pinnedAt: new Date().toISOString(),
        meta,
        ...(provenance ? { provenance: [provenance] } : {}),
      };
      await writeRepoPins([...pins, pin]);
      const resource = await projectPinnedRepositoryResource(pin);
      return c.json({ pin, resource }, 201);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch repository';
      return c.json({ error: message }, 502);
    }
  },
};

function mergeRepositoryPinProvenance(
  pin: PinnedRepository,
  provenance: RegistryPinProvenance | undefined,
): PinnedRepository {
  if (!provenance) return pin;

  const nextProvenance = [...(pin.provenance ?? [])];
  const provenanceKey = JSON.stringify(provenance);
  const alreadyRecorded = nextProvenance.some((item) => JSON.stringify(item) === provenanceKey);
  if (alreadyRecorded) return pin;

  return { ...pin, provenance: [...nextProvenance, provenance] };
}

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
