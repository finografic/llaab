import type { RunNode } from '@llaab/schemas';

export type RunDisplayStatus = RunNode['run_status'] | 'extracting';

function hasExtractionFailure(run: RunNode): boolean {
  return run.events.some((event) => event.message.toLowerCase().includes('extraction failed'));
}

/**
 * `RunsTable` is shaped around the ingest pipeline (Source/Author columns, video-subject
 * grouping) — other skill types (e.g. `consolidate-canonical-ideas`) have their own run shape
 * and belong in the Activity Monitor, not this table.
 */
export function isIngestRun(run: RunNode): boolean {
  return run.skill_id === 'ingest-youtube' || run.skill_id === 'ingest-podcast';
}

/**
 * Ingest runs are persisted as completed once the transcript exists. The client then kicks off
 * follow-on extraction, which appends idea ids and LLM trace data onto the same run.
 */
export function isRunExtracting(run: RunNode): boolean {
  return (
    (run.skill_id === 'ingest-youtube' || run.skill_id === 'ingest-podcast') &&
    run.run_status === 'completed' &&
    run.llm == null &&
    run.produced_node_ids.length === 1 &&
    !hasExtractionFailure(run)
  );
}

export function getRunDisplayStatus(run: RunNode): RunDisplayStatus {
  return isRunExtracting(run) ? 'extracting' : run.run_status;
}

export function getRunElapsedDurationMs(run: RunNode, now: number): number | undefined {
  if (isRunExtracting(run) && run.started_at) {
    return Math.max(0, now - Date.parse(run.started_at));
  }

  return run.llm?.duration_ms ?? run.duration_ms;
}
