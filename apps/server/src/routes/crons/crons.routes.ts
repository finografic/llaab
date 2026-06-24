import type { AppCtx, AppCtxJson } from '../../types/app.types.js';
import type { CreateCronRecipeBody, UpdateCronRecipeBody } from './crons.schema.js';

import { listCronHistory } from './cron-history.js';
import {
  createCronRecipe,
  listCronRecipesWithState,
  listCronScripts,
  runCronRecipe,
  updateCronRecipe,
} from './cron-recipes.js';

export const list = {
  path: '/' as const,
  handler: async (c: AppCtx) =>
    c.json({
      recipes: await listCronRecipesWithState(),
      scripts: listCronScripts(),
      history: listCronHistory(),
    }),
};

export const create = {
  path: '/' as const,
  handler: async (c: AppCtxJson<CreateCronRecipeBody>) => {
    const body = c.req.valid('json');
    try {
      const recipe = await createCronRecipe(body);
      return c.json({ success: true, recipe }, 201);
    } catch (err) {
      return c.json(
        { success: false, error: err instanceof Error ? err.message : 'Failed to create cron recipe' },
        400,
      );
    }
  },
};

export const run = {
  path: '/:id/run' as const,
  handler: async (c: AppCtx) => {
    const { id } = c.req.param();
    try {
      const { historyEntry, result } = await runCronRecipe(id);
      return c.json({ success: true, historyEntry, result });
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
      const recipe = await updateCronRecipe(id, body);
      return c.json({ success: true, recipe });
    } catch (err) {
      return c.json(
        { success: false, error: err instanceof Error ? err.message : 'Failed to update cron recipe' },
        404,
      );
    }
  },
};
