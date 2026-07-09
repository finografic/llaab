import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiGet, apiPatch, apiPost } from 'lib/api-client';

import { QUERY_KEYS } from './index';

export type CronRecipeHealth = 'ok' | 'stale' | 'failing' | 'never_ran' | 'not_installed';

export interface CronRecipe {
  id: string;
  title: string;
  description: string;
  command: string;
  risk: 'low' | 'medium' | 'high';
  cronExpression: string;
  scriptId: string;
  /**
   * Whether LLAAB has installed this recipe's managed line in the user crontab.
   */
  enabled: boolean;
  /** Operational truth beyond crontab install (stale / failing / never ran). */
  health: CronRecipeHealth;
  healthDetail?: string;
  lastRunAt?: string;
  scheduleExamples: Array<{
    label: string;
    value: string;
  }>;
}

export interface CronScript {
  id: string;
  title: string;
  description: string;
  location: string;
}

export interface CronRecipeWriteInput {
  title: string;
  description: string;
  risk: CronRecipe['risk'];
  cronExpression: string;
  scriptId: string;
}

export interface CronRecipeRunResult {
  recipeId: string;
  checked: number;
  pending: number;
  consolidated: number;
  skipped: number;
  failed: number;
  producedNodeIds: string[];
  results: Array<{
    transcriptId: string;
    title: string;
    status: 'consolidated' | 'skipped' | 'failed';
    reason?: string;
    canonicalIdeaIds?: string[];
  }>;
}

export interface CronHistoryEntry {
  id: string;
  recipeId: string;
  title: string;
  status: 'completed' | 'failed';
  startedAt: string;
  completedAt: string;
  durationMs: number;
  result?: CronRecipeRunResult;
  error?: string;
}

export interface CronRecipeRunResponse {
  success: boolean;
  historyEntry: CronHistoryEntry;
  result: CronRecipeRunResult;
}

export interface CronRecipesResponse {
  recipes: CronRecipe[];
  scripts: CronScript[];
  history: CronHistoryEntry[];
}

async function fetchCronRecipes(): Promise<CronRecipesResponse> {
  const body = await apiGet<{
    recipes?: CronRecipe[];
    scripts?: CronScript[];
    history?: CronHistoryEntry[];
  }>('/api/crons');
  return { recipes: body.recipes ?? [], scripts: body.scripts ?? [], history: body.history ?? [] };
}

async function runCronRecipe(recipeId: string): Promise<CronRecipeRunResponse> {
  return apiPost<CronRecipeRunResponse>(`/api/crons/${recipeId}/run`, {});
}

async function createCronRecipe(
  input: CronRecipeWriteInput,
): Promise<{ success: boolean; recipe: CronRecipe }> {
  return apiPost('/api/crons', input);
}

interface SetCronRecipeEnabledInput {
  recipeId: string;
  enabled: boolean;
}

interface UpdateCronRecipeInput extends Partial<CronRecipeWriteInput> {
  recipeId: string;
  enabled?: boolean;
}

async function updateCronRecipe({
  recipeId,
  ...body
}: UpdateCronRecipeInput): Promise<{ success: boolean; recipe: CronRecipe }> {
  return apiPatch(`/api/crons/${recipeId}`, body);
}

export function useCronRecipes() {
  return useQuery({
    queryKey: QUERY_KEYS.crons.list(),
    queryFn: fetchCronRecipes,
  });
}

export function useRunCronRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: runCronRecipe,
    onMutate: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.crons.list() });
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.crons.list() });
    },
  });
}

export function useCreateCronRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCronRecipe,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.crons.list() });
    },
  });
}

export function useUpdateCronRecipe() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateCronRecipe,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.crons.list() });
    },
  });
}

export function useSetCronRecipeEnabled() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: SetCronRecipeEnabledInput) => updateCronRecipe(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.crons.list() });
    },
  });
}

async function repairCronRecipes(): Promise<{
  success: boolean;
  repaired: string[];
  recipes: CronRecipe[];
}> {
  return apiPost('/api/crons/repair', {});
}

export function useRepairCronRecipes() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: repairCronRecipes,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.crons.list() });
    },
  });
}
