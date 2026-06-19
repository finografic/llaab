import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS as RUN_KEYS } from 'queries/runs';

import { apiGet, apiPatch, apiPost } from 'lib/api-client';

import { QUERY_KEYS } from './index';

export interface CronRecipe {
  id: string;
  title: string;
  description: string;
  command: string;
  risk: 'low' | 'medium' | 'high';
  /**
   * Whether the recipe will execute when triggered. This is a kill-switch on the one-shot
   * run endpoint, not a "currently scheduled" indicator — LLAAB owns no scheduler, so it
   * has no visibility into whether an external cron/launchd job is actually configured.
   */
  enabled: boolean;
  scheduleExamples: Array<{
    label: string;
    value: string;
  }>;
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

export interface CronRecipeRunResponse {
  success: boolean;
  runNodeId: string;
  result: CronRecipeRunResult;
}

async function fetchCronRecipes(): Promise<CronRecipe[]> {
  const body = await apiGet<{ recipes?: CronRecipe[] }>('/api/crons');
  return body.recipes ?? [];
}

async function runCronRecipe(recipeId: string): Promise<CronRecipeRunResponse> {
  return apiPost<CronRecipeRunResponse>(`/api/crons/${recipeId}/run`, {});
}

interface SetCronRecipeEnabledInput {
  recipeId: string;
  enabled: boolean;
}

async function setCronRecipeEnabled({
  recipeId,
  enabled,
}: SetCronRecipeEnabledInput): Promise<{ success: boolean; id: string; enabled: boolean }> {
  return apiPatch(`/api/crons/${recipeId}`, { enabled });
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
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.monitor() });
      window.setTimeout(
        () => void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.monitor() }),
        1000,
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.all });
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.monitor() });
    },
  });
}

export function useSetCronRecipeEnabled() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: setCronRecipeEnabled,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.crons.list() });
    },
  });
}
