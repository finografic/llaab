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

/**
 * Polls faster while any run is active so the monitor trigger badge and sheet stay current even
 * when the sheet is closed; backs off once nothing is running.
 */
const ACTIVE_POLL_INTERVAL_MS = 4000;
const IDLE_POLL_INTERVAL_MS = 20000;

export function useRunMonitor({ refetchInterval }: UseRunMonitorOptions = {}) {
  return useQuery({
    queryKey: QUERY_KEYS.runs.monitor(),
    queryFn: fetchRunMonitor,
    refetchInterval:
      refetchInterval ??
      ((query) => {
        const {data} = query.state;
        return data && data.active.length > 0 ? ACTIVE_POLL_INTERVAL_MS : IDLE_POLL_INTERVAL_MS;
      }),
  });
}
