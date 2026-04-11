import { readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalCwd = process.cwd();

describe('runSkill', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await (await import('node:fs/promises')).mkdtemp(join(tmpdir(), 'llaab-skills-'));
    process.chdir(tempDir);
    vi.resetModules();
  });

  afterEach(async () => {
    process.chdir(originalCwd);
    await rm(tempDir, { force: true, recursive: true });
  });

  it('persists a run node with status and stage data', async () => {
    const skills = await import('@llaab/skills');
    const core = await import('@llaab/core');

    const { record, result } = await skills.runSkill(
      'demo-skill',
      async (input: { text: string }) => ({ echoed: input.text }),
      { text: 'hello' },
    );

    expect(record.status).toBe('completed');
    expect(result).toEqual({ echoed: 'hello' });

    const runDir = join(tempDir, 'vault', 'runs');
    const runFiles = await readdir(runDir);

    expect(runFiles.length).toBe(1);

    const runPath = join(runDir, runFiles[0]);
    const runNode = await core.readNode(runPath);

    expect(runNode.type).toBe('run');

    if (runNode.type !== 'run') return;

    expect(runNode.runStatus).toBe('completed');
    expect(runNode.stages).toHaveLength(1);
    expect(runNode.stages[0]?.name).toBe('execute');
    expect(runNode.decisions).toHaveLength(1);
    expect(runNode.decisions[0]?.type).toBe('accept');
  });
});
