import { useQuery } from '@tanstack/react-query';
import type { RunNode } from '@llaab/schemas';

import { api } from 'lib/api';

import { QUERY_KEYS } from './index';

async function fetchRuns(): Promise<RunNode[]> {
  const res = await api.runs.$get();
  const body = (await res.json()) as { runs?: RunNode[] };

  if (!res.ok || !body.runs) {
    throw new Error('Failed to load runs.');
  }

  return body.runs.toSorted((a, b) => b.created_at.localeCompare(a.created_at));
}

export interface UseRunsOptions {
  /** SSR-rendered data — lets islands hydrate without a refetch flash. */
  initialData?: RunNode[];
  /** Defaults to `true`. Set `false` to defer fetching (e.g. until a dialog opens). */
  enabled?: boolean;
}

/** List runs, sorted newest-first. */
export function useRuns({ initialData, enabled = true }: UseRunsOptions = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.runs.list(),
    queryFn: fetchRuns,
    initialData,
    enabled,
  });
}
