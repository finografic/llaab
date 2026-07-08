import { getNodeFilePath, listNodes, updateNode } from '@llaab/core';
import { enrichSourceMetadata } from '@llaab/ingestion';
import { formatNodeFilename } from '@llaab/schemas';
import type { AppCtx, AppCtxJson } from '../../types/app.types.js';
import type { UpdateSourceProfilesBody } from './vault.schema.js';
import type { SourceNode } from '@llaab/schemas';

import { commitVaultFile, isVaultFileTracked } from '../../lib/vault-git.js';

export const enrichSource = {
  path: '/sources/:id/enrich' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    const force = c.req.query('force') === 'true';

    const nodes = await listNodes({ type: 'source' });
    const source = nodes.find((node) => node.id === id) as SourceNode | undefined;
    if (!source) return c.json({ error: 'Source not found' }, 404);

    try {
      const result = await enrichSourceMetadata(source, { force });

      let metadataCommitted = false;
      let metadataCommitError: string | undefined;

      if (result.persisted) {
        const relativePath = `sources/${formatNodeFilename('source', id)}`;
        try {
          if (await isVaultFileTracked(relativePath)) {
            const commitResult = await commitVaultFile(
              relativePath,
              `chore(vault): refresh source metadata for ${result.source.title}`,
              { skipHooks: true },
            );
            metadataCommitted = !commitResult.skipped;
          }
        } catch (commitErr) {
          metadataCommitError =
            commitErr instanceof Error ? commitErr.message : 'Failed to commit source metadata refresh.';
        }
      }

      return c.json({
        source: result.source,
        fetched: result.fetched,
        persisted: result.persisted,
        subscriptionChecked: result.subscriptionChecked,
        subscriptionError: result.subscriptionError,
        metadataCommitted,
        metadataCommitError,
      });
    } catch (err) {
      return c.json(
        {
          error: err instanceof Error ? err.message : 'Failed to enrich source metadata.',
        },
        500,
      );
    }
  },
};

export const updateSourceProfiles = {
  path: '/sources/:id/profiles' as const,
  handler: async (c: AppCtxJson<UpdateSourceProfilesBody>) => {
    const id = c.req.param('id');
    if (!id) return c.json({ error: 'Source id is required.' }, 400);
    const { profiles } = c.req.valid('json');
    const sourcePath = getNodeFilePath('source', id);

    try {
      const result = await updateNode(sourcePath, (current) => {
        if (current.type !== 'source') {
          throw new Error('Source not found');
        }

        const profilePlatforms = new Set(profiles.map((profile) => profile.platform));
        const platforms = [
          ...new Set([...current.platforms.filter((platform) => platform !== 'github'), ...profilePlatforms]),
        ];

        return {
          ...current,
          platforms,
          profiles,
        };
      });

      return c.json({ source: result.node });
    } catch (err) {
      return c.json(
        {
          error: err instanceof Error ? err.message : 'Failed to update source profiles.',
        },
        500,
      );
    }
  },
};
