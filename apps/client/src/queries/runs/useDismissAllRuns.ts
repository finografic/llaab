import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from 'lib/api';

import { QUERY_KEYS } from './index';

interface DismissAllRunsResult {
  success: boolean;
  dismissedRunIds: string[];
  error?: string;
}

/** Dismiss every inactive run from the Run Monitor without deleting run nodes. */
export function useDismissAllRuns() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const res = await api.runs['dismiss-all'].$post();
      const body = (await res.json().catch(() => null)) as DismissAllRunsResult | null;

      if (!res.ok) {
        throw new Error(body?.error ?? 'Failed to dismiss runs.');
      }

      return body;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.runs.monitor() });
    },
  });
}
