import { useCallback, useEffect, useState } from 'react';
import type { RunNode } from '@llaab/schemas';

import { api } from 'lib/api';
import { RUNS_CHANGED_EVENT } from 'lib/runs-events';

async function fetchRuns(): Promise<RunNode[]> {
  const res = await api.runs.$get();
  const body = (await res.json()) as { runs?: RunNode[] };

  if (!res.ok || !body.runs) {
    throw new Error('Failed to load runs.');
  }

  return body.runs.toSorted((a, b) => b.created_at.localeCompare(a.created_at));
}

export function useRuns(initialRuns: RunNode[]) {
  const [runs, setRuns] = useState(initialRuns);

  const refetch = useCallback(async () => {
    try {
      setRuns(await fetchRuns());
    } catch {
      // Keep the last good list when refetch fails.
    }
  }, []);

  useEffect(() => {
    const onChanged = () => {
      void refetch();
    };

    window.addEventListener(RUNS_CHANGED_EVENT, onChanged);
    return () => window.removeEventListener(RUNS_CHANGED_EVENT, onChanged);
  }, [refetch]);

  return { runs, refetch };
}
