import { useMutation, useQueryClient } from '@tanstack/react-query';

import { deleteVaultRun } from 'lib/api';

import { QUERY_KEYS } from './index';

export interface DeleteRunInput {
  id: string;
  deleteProduced: boolean;
}

export interface DeleteRunResult {
  deletedProduced: number;
}

/** Delete a run (and optionally the nodes it produced), invalidating the runs list on success. */
export function useDeleteRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, deleteProduced }: DeleteRunInput): Promise<DeleteRunResult> => {
      const res = await deleteVaultRun(id, deleteProduced);
      const body = (await res.json().catch(() => null)) as {
        error?: string;
        deletedProduced?: number;
      } | null;

      if (!res.ok) {
        throw new Error(body?.error ?? 'Failed to delete run.');
      }

      return { deletedProduced: body?.deletedProduced ?? 0 };
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.runs.all });
    },
  });
}
