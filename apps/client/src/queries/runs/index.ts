export const QUERY_KEYS = {
  runs: {
    all: ['runs'] as const,
    list: () => [...QUERY_KEYS.runs.all, 'list'] as const,
  },
};

export { useRuns } from './useRuns';
export { useDeleteRun } from './useDeleteRun';
export type { DeleteRunInput, DeleteRunResult } from './useDeleteRun';
