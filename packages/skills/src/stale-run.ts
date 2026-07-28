import { getNodeFilePath, listNodes, readNode, updateNode } from '@llaab/core';
import { formatIsoUtcSeconds } from '@llaab/schemas';
import type { RunNode } from '@llaab/schemas';

const ACTIVE_RUN_STATUSES = new Set<RunNode['run_status']>(['pending', 'running']);

const DEFAULT_STALE_MS = 30 * 60 * 1000;

const SKILL_STALE_MS: Record<string, number> = {
  'consolidate-canonical-ideas': 30 * 60 * 1000,
  'compile-wiki-draft': 30 * 60 * 1000,
  'extract-transcript-ideas': 45 * 60 * 1000,
  'ingest-youtube': 90 * 60 * 1000,
  // Local mlx-whisper transcription of a long episode can take a while on top of the fetch/RSS steps.
  'ingest-podcast': 120 * 60 * 1000,
  // A bounded 20s fetch plus one extraction pass; nothing here should run long.
  'ingest-article': 30 * 60 * 1000,
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

export function isRunActive(run: RunNode): boolean {
  return ACTIVE_RUN_STATUSES.has(run.run_status);
}

export function isRunStale(run: RunNode, nowMs = Date.now()): boolean {
  if (!isRunActive(run)) return false;
  if (!run.started_at) return false;

  const startedMs = Date.parse(run.started_at);
  if (!Number.isFinite(startedMs)) return false;

  return nowMs - startedMs > getRunStaleAfterMs(run.skill_id);
}

export function buildStaleRunErrorMessage(skillId?: string): string {
  const limitMinutes = Math.round(getRunStaleAfterMs(skillId) / 60_000);
  return `Run exceeded maximum duration (${limitMinutes}m) with no completion recorded — the skill handler likely hung (provider stall) while the server stayed up.`;
}

export function buildOrphanedRunErrorMessage(): string {
  return 'Run aborted: server restarted while this skill was still in progress (in-memory work does not survive restarts).';
}

async function failActiveRunNode(run: RunNode, completedAt: string, error: string): Promise<void> {
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
          reason: 'Run was marked failed after the skill handler stopped without completing.',
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

async function rereadRun(runId: string): Promise<RunNode> {
  const runPath = getNodeFilePath('run', runId);
  const updated = await readNode(runPath);
  if (updated.type !== 'run') {
    throw new Error(`Expected run node after reconciliation: ${runId}`);
  }
  return updated;
}

export async function reconcileStaleRun(run: RunNode): Promise<RunNode> {
  if (!isRunStale(run)) return run;

  const completedAt = formatIsoUtcSeconds(new Date());
  const error = buildStaleRunErrorMessage(run.skill_id);

  await failActiveRunNode(run, completedAt, error);
  return rereadRun(run.id);
}

/**
 * Fail every still-active RunNode. Call on server boot: LLAAB has no background workers, so any
 * `pending`/`running` run left on disk after a restart is orphaned in-memory work.
 */
export async function reconcileOrphanedActiveRuns(): Promise<number> {
  const all = await listNodes({ type: 'run' });
  const completedAt = formatIsoUtcSeconds(new Date());
  const error = buildOrphanedRunErrorMessage();
  let reconciled = 0;

  for (const node of all) {
    if (node.type !== 'run') continue;
    if (!isRunActive(node)) continue;
    await failActiveRunNode(node, completedAt, error);
    reconciled += 1;
  }

  return reconciled;
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
