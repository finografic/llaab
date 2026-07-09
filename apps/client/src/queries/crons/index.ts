export const QUERY_KEYS = {
  crons: {
    all: ['crons'] as const,
    list: () => [...QUERY_KEYS.crons.all, 'list'] as const,
  },
};

export {
  useCreateCronRecipe,
  useCronRecipes,
  useRepairCronRecipes,
  useRunCronRecipe,
  useSetCronRecipeEnabled,
  useUpdateCronRecipe,
} from './useCrons';
export type {
  CronHistoryEntry,
  CronRecipe,
  CronRecipeHealth,
  CronRecipeWriteInput,
  CronRecipeRunResponse,
  CronRecipeRunResult,
  CronRecipesResponse,
  CronScript,
} from './useCrons';
