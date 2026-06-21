import type { AppCtx, AppCtxJson } from '../../types/app.types.js';
import type { UpdateCronRecipeBody } from './crons.schema.js';

import { listCronRecipesWithState, runCronRecipe, setCronRecipeEnabled } from './cron-recipes.js';

export const list = {
  path: '/' as const,
  handler: async (c: AppCtx) => c.json({ recipes: await listCronRecipesWithState() }),
};

export const run = {
  path: '/:id/run' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    try {
      const { runNodeId, result } = await runCronRecipe(id);
      return c.json({ success: true, runNodeId, result });
    } catch (err) {
      return c.json(
        { success: false, error: err instanceof Error ? err.message : 'Cron recipe failed' },
        500,
      );
    }
  },
};

export const update = {
  path: '/:id' as const,
  handler: async (c: AppCtxJson<UpdateCronRecipeBody>) => {
    const id = c.req.param('id');
    if (!id) return c.json({ success: false, error: 'Recipe id is required.' }, 400);
    const body = c.req.valid('json');
    try {
      const enabled = await setCronRecipeEnabled(id, body.enabled);
      return c.json({ success: true, id, enabled });
    } catch (err) {
      return c.json(
        { success: false, error: err instanceof Error ? err.message : 'Failed to update cron recipe' },
        404,
      );
    }
  },
};
