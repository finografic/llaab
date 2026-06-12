export const QUERY_KEYS = {
  runs: {
    all: ['runs'] as const,
    list: () => [...QUERY_KEYS.runs.all, 'list'] as const,
    monitor: () => [...QUERY_KEYS.runs.all, 'monitor'] as const,
  },
};

export { useRunMonitor } from './useRunMonitor';
export { useRuns } from './useRuns';
export { useDeleteRun } from './useDeleteRun';
export type { DeleteRunInput, DeleteRunResult } from './useDeleteRun';
