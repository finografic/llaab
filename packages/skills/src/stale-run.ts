import { getNodeFilePath, listNodes, readNode, updateNode } from '@llaab/core';
import { formatIsoUtcSeconds } from '@llaab/schemas';
import type { RunNode } from '@llaab/schemas';

const ACTIVE_RUN_STATUSES = new Set<RunNode['run_status']>(['pending', 'running']);

const DEFAULT_STALE_MS = 30 * 60 * 1000;

const SKILL_STALE_MS: Record<string, number> = {
  'consolidate-canonical-ideas': 30 * 60 * 1000,
  'extract-transcript-ideas': 45 * 60 * 1000,
  'ingest-youtube': 90 * 60 * 1000,
};

function parsePositiveMs(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function getRunStaleAfterMs(skillId?: string): number {
  const globalOverride = parsePositiveMs(process.env['LLAAB_RUN_STALE_MS']);
  if (globalOverride) return globalOverride;

  if (skillId && SKILL_STALE_MS[skillId]) return SKILL_STALE_MS[skillId];

  return DEFAULT_STALE_MS;
}

export function isRunStale(run: RunNode, nowMs = Date.now()): boolean {
  if (!ACTIVE_RUN_STATUSES.has(run.run_status)) return false;
  if (!run.started_at) return false;

  const startedMs = Date.parse(run.started_at);
  if (!Number.isFinite(startedMs)) return false;

  return nowMs - startedMs > getRunStaleAfterMs(run.skill_id);
}

export function buildStaleRunErrorMessage(skillId?: string): string {
  const limitMinutes = Math.round(getRunStaleAfterMs(skillId) / 60_000);
  return `Run exceeded maximum duration (${limitMinutes}m) with no completion recorded — likely interrupted while the provider was busy or the server restarted.`;
}

async function failStaleRunNode(run: RunNode, completedAt: string, error: string): Promise<void> {
  const skillName = run.skill_id ?? 'unknown-skill';
  const runPath = getNodeFilePath('run', run.id);

  await updateNode(runPath, (node) => {
    const current = node as RunNode;

    return {
      ...current,
      run_status: 'failed',
      error,
      completed_at: completedAt,
      duration_ms: current.started_at
        ? Date.parse(completedAt) - Date.parse(current.started_at)
        : current.duration_ms,
      stages: current.stages.map((stage) =>
        stage.name === 'execute'
          ? {
              ...stage,
              status: 'failed' as const,
              error,
            }
          : stage,
      ),
      decisions: [
        ...current.decisions,
        {
          type: 'reject' as const,
          reason: 'Run was marked failed after exceeding the maximum active duration.',
        },
      ],
      events: [
        ...current.events,
        {
          id: 'finish',
          at: completedAt,
          level: 'error' as const,
          message: `${skillName} failed: ${error}`,
        },
      ],
      llm: current.llm
        ? {
            ...current.llm,
            progress_status: 'timed out',
          }
        : current.llm,
    };
  });
}

export async function reconcileStaleRun(run: RunNode): Promise<RunNode> {
  if (!isRunStale(run)) return run;

  const completedAt = formatIsoUtcSeconds(new Date());
  const error = buildStaleRunErrorMessage(run.skill_id);

  await failStaleRunNode(run, completedAt, error);

  const runPath = getNodeFilePath('run', run.id);
  const updated = await readNode(runPath);
  if (updated.type !== 'run') {
    throw new Error(`Expected run node after stale reconciliation: ${run.id}`);
  }

  return updated;
}

export async function reconcileAllStaleRuns(): Promise<number> {
  const all = await listNodes({ type: 'run' });
  let reconciled = 0;

  for (const node of all) {
    if (node.type !== 'run') continue;
    if (!isRunStale(node)) continue;
    await reconcileStaleRun(node);
    reconciled += 1;
  }

  return reconciled;
}
