export const QUERY_KEYS = {
  crons: {
    all: ['crons'] as const,
    list: () => [...QUERY_KEYS.crons.all, 'list'] as const,
  },
};

export { useCronRecipes, useRunCronRecipe } from './useCrons';
export type { CronRecipe, CronRecipeRunResponse, CronRecipeRunResult } from './useCrons';
