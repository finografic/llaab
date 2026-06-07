import type { RunNode } from '@llaab/schemas';

/** Count runs whose latest timestamp falls within the last `hours` hours. */
export function countRunsWithinHours(runs: RunNode[], hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) {
    return 0;
  }

  const cutoffMs = hours * 60 * 60 * 1000;
  const now = Date.now();

  return runs.filter((run) => {
    const timestamp = run.updated_at ?? run.created_at;
    const ageMs = now - new Date(timestamp).getTime();
    return ageMs >= 0 && ageMs <= cutoffMs;
  }).length;
}
