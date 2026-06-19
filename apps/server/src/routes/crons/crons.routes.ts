import type { AppCtx } from '../../types/app.types.js';

import { CRON_RECIPES, runCronRecipe } from './cron-recipes.js';

export const list = {
  path: '/' as const,
  handler: async (c: AppCtx) => c.json({ recipes: CRON_RECIPES }),
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
