import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { apiGet, apiPut } from 'lib/api-client';

interface UiStateResponse<T> {
  key: string;
  value: T | null;
}

function uiStateQueryKey(key: string) {
  return ['ui-state', key] as const;
}

/**
 * Persists a single piece of UI state (filter selections, panel toggles, etc.) across page
 * reloads and app restarts, backed by `configs/ui-state.json` on the server — see
 * `apps/server/src/routes/ui-state/AGENTS.md` for the full pattern. `key` should be a stable,
 * namespaced string (e.g. `'transcripts.authorFilter'`) so unrelated features never collide.
 *
 * Not for content the rest of the app needs to react to (vault data, run status) — those go
 * through their own domain query hooks. This is purely "what did the user last pick in this
 * control."
 */
export function usePersistedUiState<T>(
  key: string,
  defaultValue: T,
): {
  value: T;
  setValue: (value: T) => void;
  isLoading: boolean;
} {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: uiStateQueryKey(key),
    queryFn: () => apiGet<UiStateResponse<T>>(`/api/ui-state/${key}`),
  });

  const mutation = useMutation({
    mutationFn: (value: T) => apiPut<UiStateResponse<T>>(`/api/ui-state/${key}`, { value }),
    onSuccess: (data) => {
      queryClient.setQueryData(uiStateQueryKey(key), data);
    },
  });

  const value = query.data?.value ?? defaultValue;

  return {
    value,
    setValue: mutation.mutate,
    isLoading: query.isLoading,
  } as const;
}
