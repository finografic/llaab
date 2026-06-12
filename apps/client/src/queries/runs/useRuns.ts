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
  /** Prefetched data for hydration; pass `initialDataUpdatedAt: 0` so the query still refetches. */
  initialData?: RunNode[];
  initialDataUpdatedAt?: number;
  /** Defaults to `true`. Set `false` to defer fetching (e.g. until a dialog opens). */
  enabled?: boolean;
}

/** List runs, sorted newest-first. */
export function useRuns({ initialData, initialDataUpdatedAt, enabled = true }: UseRunsOptions = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.runs.list(),
    queryFn: fetchRuns,
    initialData,
    initialDataUpdatedAt,
    enabled,
  });
}
