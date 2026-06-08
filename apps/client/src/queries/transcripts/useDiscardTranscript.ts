import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QUERY_KEYS as RUN_KEYS } from 'queries/runs';

import { api } from 'lib/api';

/** Delete a saved transcript (and its produced nodes), invalidating the runs list on success. */
export function useDiscardTranscript() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (transcriptId: string): Promise<void> => {
      const res = await api.vault.transcripts[':id'].$delete({ param: { id: transcriptId } });
      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(json.error ?? `Delete failed (${res.status})`);
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: RUN_KEYS.runs.list() });
    },
  });
}
