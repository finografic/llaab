import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS as RUN_KEYS } from 'queries/runs';

import { apiGet, apiPost } from 'lib/api-client';

import { QUERY_KEYS } from './index';

export interface CronRecipe {
  id: string;
  title: string;
  description: string;
  command: string;
  risk: 'low' | 'medium' | 'high';
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
