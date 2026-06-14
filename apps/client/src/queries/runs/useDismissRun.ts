import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from 'lib/api';

import { QUERY_KEYS } from './index';

/** Dismiss a run from the Run Monitor's recent list without deleting the run node. */
export function useDismissRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.runs[':id'].dismiss.$post({ param: { id } });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        throw new Error(body?.error ?? 'Failed to dismiss run.');
      }

      return body;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.runs.monitor() });
    },
  });
}
