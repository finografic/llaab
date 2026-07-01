import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

    await core.createNode({
      type: 'run',
      id: 'stale-test-run',
      title: 'stale test run',
      body: '',
      tags: ['run', 'consolidate-canonical-ideas'],
      extra: {
        status: 'mature',
        skill_id: 'consolidate-canonical-ideas',
        run_status: 'running',
        started_at: startedAt,
        produced_node_ids: [],
        stages: [{ name: 'execute', status: 'pending', input: { transcriptId: 'demo' } }],
        decisions: [],
        events: [
          { id: 'start', at: startedAt, level: 'info', message: 'Started consolidate-canonical-ideas' },
        ],
        llm: { model: 'demo', provider: 'lmstudio', progress_status: 'processing prompt' },
      },
    });

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
});
