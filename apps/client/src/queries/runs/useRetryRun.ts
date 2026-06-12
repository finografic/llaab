import { useMutation, useQueryClient } from '@tanstack/react-query';

import { api } from 'lib/api';

import { QUERY_KEYS } from './index';

/** Retry a failed ingest-youtube run, invalidating the monitor on success. */
export function useRetryRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const res = await api.runs[':id'].retry.$post({ param: { id } });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        throw new Error(body?.error ?? 'Failed to retry run.');
      }

      return body;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: QUERY_KEYS.runs.all });
    },
  });
}
