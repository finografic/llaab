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

  it('promotes nested control decisions and llm trace into the persisted run node', async () => {
    const skills = await import('@llaab/skills');
    const core = await import('@llaab/core');

    await skills.runSkill(
      'trace-aware-skill',
      async () => ({
        echoed: 'ok',
        runTrace: {
          stages: [
            {
              name: 'control:extract-knowledge',
              status: 'completed',
              output: { summary: 'usable summary' },
            },
          ],
          decisions: [
            {
              type: 'retry',
              reason: 'Initial schema validation failed.',
            },
            {
              type: 'accept',
              reason: 'Schema validation passed on retry.',
            },
          ],
          llm: {
            model: 'ollama',
            rawOutput: '{"summary":"usable summary"}',
            parsed: true,
          },
        },
      }),
      {},
    );

    const runDir = join(tempDir, 'vault', 'runs');
    const runFiles = await readdir(runDir);
    const runPath = join(runDir, runFiles[0]);
    const runNode = await core.readNode(runPath);

    expect(runNode.type).toBe('run');

    if (runNode.type !== 'run') return;

    expect(runNode.stages.some((stage) => stage.name === 'control:extract-knowledge')).toBe(true);
    expect(runNode.decisions.some((decision) => decision.type === 'retry')).toBe(true);
    expect(runNode.llm?.model).toBe('ollama');
    expect(runNode.llm?.parsed).toBe(true);
  });

  it('preserves nested control decisions when a controlled execution fails', async () => {
    const skills = await import('@llaab/skills');
    const core = await import('@llaab/core');
    const control = await import('@llaab/control');

    await skills.runSkill(
      'failing-trace-aware-skill',
      async () => {
        throw new control.ControlExecutionError({
          message: 'Schema validation failed for task "extract-knowledge".',
          task: 'extract-knowledge',
          attempts: 2,
          decisions: [
            {
              type: 'retry',
              reason: 'Initial schema validation failed.',
            },
            {
              type: 'reject',
              reason: 'Schema validation failed and output was rejected.',
            },
          ],
          stages: [
            {
              name: 'control:extract-knowledge',
              status: 'failed',
              error: 'Summary was empty.',
            },
          ],
          llm: {
            model: 'ollama',
            rawOutput: '{"summary":""}',
            parsed: false,
          },
        });
      },
      {},
    );

    const runDir = join(tempDir, 'vault', 'runs');
    const runFiles = await readdir(runDir);
    const runPath = join(runDir, runFiles[0]);
    const runNode = await core.readNode(runPath);

    expect(runNode.type).toBe('run');

    if (runNode.type !== 'run') return;

    expect(runNode.runStatus).toBe('failed');
    expect(runNode.decisions.some((decision) => decision.type === 'retry')).toBe(true);
    expect(runNode.decisions.some((decision) => decision.type === 'reject')).toBe(true);
    expect(runNode.llm?.model).toBe('ollama');
    expect(runNode.llm?.parsed).toBe(false);
  });
});
