import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function createActiveRun(args: { id: string; startedAt: string; skillId?: string }): Promise<void> {
  const core = await import('@llaab/core');
  await core.createNode({
    type: 'run',
    id: args.id,
    title: `${args.id} run`,
    body: '',
    tags: ['run', args.skillId ?? 'consolidate-canonical-ideas'],
    extra: {
      status: 'mature',
      skill_id: args.skillId ?? 'consolidate-canonical-ideas',
      run_status: 'running',
      started_at: args.startedAt,
      produced_node_ids: [],
      stages: [{ name: 'execute', status: 'pending', input: { transcriptId: 'demo' } }],
      decisions: [],
      events: [
        {
          id: 'start',
          at: args.startedAt,
          level: 'info',
          message: 'Started consolidate-canonical-ideas',
        },
      ],
      llm: { model: 'demo', provider: 'lmstudio', progress_status: 'processing prompt' },
    },
  });
}

describe('stale runs', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await (await import('node:fs/promises')).mkdtemp(join(tmpdir(), 'llaab-stale-runs-'));
    process.env.LLAAB_VAULT = join(tempDir, 'vault');
    vi.resetModules();
  });

  afterEach(async () => {
    delete process.env.LLAAB_VAULT;
    delete process.env.LLAAB_RUN_STALE_MS;
    await rm(tempDir, { force: true, recursive: true });
  });

  it('marks long-running active runs as failed during reconciliation', async () => {
    process.env.LLAAB_RUN_STALE_MS = '1000';
    const skills = await import('@llaab/skills');
    const core = await import('@llaab/core');
    const { formatIsoUtcSeconds } = await import('@llaab/schemas');

    const startedAt = formatIsoUtcSeconds(new Date(Date.now() - 5 * 60 * 1000));
    await createActiveRun({ id: 'stale-test-run', startedAt });

    const runPath = join(tempDir, 'vault', 'runs', 'run.stale-test-run.md');
    const initial = await core.readNode(runPath);

    expect(initial.type).toBe('run');
    if (initial.type !== 'run') return;
    expect(initial.run_status).toBe('running');

    const reconciled = await skills.reconcileStaleRun(initial);
    expect(reconciled.run_status).toBe('failed');
    expect(reconciled.error).toMatch(/exceeded maximum duration/i);
    expect(reconciled.llm?.progress_status).toBe('timed out');
    expect(reconciled.events.some((event) => event.id === 'finish')).toBe(true);
  });

  it('fails every active run on orphan reconciliation (server restart)', async () => {
    const skills = await import('@llaab/skills');
    const core = await import('@llaab/core');
    const { formatIsoUtcSeconds } = await import('@llaab/schemas');

    // Fresh run — not stale by wall-clock, but orphaned after restart.
    const startedAt = formatIsoUtcSeconds(new Date());
    await createActiveRun({ id: 'orphan-test-run', startedAt });

    const count = await skills.reconcileOrphanedActiveRuns();
    expect(count).toBe(1);

    const runPath = join(tempDir, 'vault', 'runs', 'run.orphan-test-run.md');
    const updated = await core.readNode(runPath);
    expect(updated.type).toBe('run');
    if (updated.type !== 'run') return;
    expect(updated.run_status).toBe('failed');
    expect(updated.error).toMatch(/server restarted/i);
  });

  it('does not treat a fresh active run as stale', async () => {
    process.env.LLAAB_RUN_STALE_MS = String(60 * 60 * 1000);
    const skills = await import('@llaab/skills');
    const core = await import('@llaab/core');
    const { formatIsoUtcSeconds } = await import('@llaab/schemas');

    const startedAt = formatIsoUtcSeconds(new Date());
    await createActiveRun({ id: 'fresh-active-run', startedAt });

    const runPath = join(tempDir, 'vault', 'runs', 'run.fresh-active-run.md');
    const initial = await core.readNode(runPath);
    expect(initial.type).toBe('run');
    if (initial.type !== 'run') return;

    const reconciled = await skills.reconcileStaleRun(initial);
    expect(reconciled.run_status).toBe('running');
    expect(skills.isRunStale(initial)).toBe(false);
  });
});
