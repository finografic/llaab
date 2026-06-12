import { useQuery } from '@tanstack/react-query';
import type { RunMonitorResponse } from '@llaab/schemas';

import { api } from 'lib/api';

import { QUERY_KEYS } from './index';

async function fetchRunMonitor(): Promise<RunMonitorResponse> {
  const res = await api.runs.monitor.$get();

  if (!res.ok) {
    const body = (await res.json()) as { error?: string };
    throw new Error(body.error ?? 'Failed to load run monitor.');
  }

  return (await res.json()) as RunMonitorResponse;
}

interface UseRunMonitorOptions {
  refetchInterval?: false | number;
}

export function useRunMonitor({ refetchInterval }: UseRunMonitorOptions = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.runs.monitor(),
    queryFn: fetchRunMonitor,
    refetchInterval,
  });
}
