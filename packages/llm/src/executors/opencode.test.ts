import { EventEmitter } from 'node:events';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Characterization tests for the OpenCode executor (Fable migration A0): binary detection via
 * `which`, the confirmation gate, CLI command construction, the context bundle, and result
 * mapping. node:child_process spawn is mocked with a scriptable fake child process.
 */

const cp = vi.hoisted(() => ({ spawn: vi.fn() }));

vi.mock('node:child_process', () => ({ spawn: cp.spawn }));

import { getExecutorStatus } from '../executor-router.js';
import { opencodeExecutor } from './opencode.js';

interface SpawnScript {
  stdout?: string[];
  stderr?: string[];
  exitCode?: number | null;
  error?: Error;
}

let capturedContextPath: string | undefined;
let capturedContextFile: string | undefined;

function makeChild() {
  const makeStream = () => {
    const stream = new EventEmitter() as EventEmitter & { setEncoding: (encoding: string) => unknown };
    stream.setEncoding = () => stream;
    return stream;
  };
  const child = new EventEmitter() as EventEmitter & {
    stdout: ReturnType<typeof makeStream>;
    stderr: ReturnType<typeof makeStream>;
    stdin: { end: (input?: string) => void };
  };
  child.stdout = makeStream();
  child.stderr = makeStream();
  child.stdin = { end: vi.fn() };
  return child;
}

function mockSpawnScript(script: SpawnScript) {
  cp.spawn.mockImplementation((_command: string, args: string[]) => {
    const child = makeChild();
    setImmediate(() => {
      // Capture the context bundle while the temp dir still exists (it is removed in finally).
      const fileFlag = args.indexOf('--file');
      if (fileFlag !== -1) {
        capturedContextPath = args[fileFlag + 1];
        capturedContextFile = readFileSync(String(args[fileFlag + 1]), 'utf8');
      }
      if (script.error) {
        child.emit('error', script.error);
        return;
      }
      for (const chunk of script.stdout ?? []) child.stdout.emit('data', chunk);
      for (const chunk of script.stderr ?? []) child.stderr.emit('data', chunk);
      child.emit('close', script.exitCode === undefined ? 0 : script.exitCode);
    });
    return child;
  });
}

beforeEach(() => {
  cp.spawn.mockReset();
  capturedContextPath = undefined;
  capturedContextFile = undefined;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('opencodeExecutor.run confirmation gate', () => {
  it('rejects without spawning when the plan is not confirmed', async () => {
    await expect(opencodeExecutor.run({ instructions: 'do it', task: 'task-1' })).rejects.toThrow(
      'OpenCode execution requires explicit confirmation.',
    );
    expect(cp.spawn).not.toHaveBeenCalled();
  });
});

describe('opencodeExecutor.isAvailable', () => {
  it('is true when `which opencode` exits 0 with a path on stdout', async () => {
    mockSpawnScript({ stdout: ['/usr/local/bin/opencode\n'], exitCode: 0 });

    expect(await opencodeExecutor.isAvailable()).toBe(true);
    expect(cp.spawn).toHaveBeenCalledWith('which', ['opencode'], {
      cwd: undefined,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
  });

  it('is false when the binary is not found or stdout is empty', async () => {
    mockSpawnScript({ exitCode: 1 });
    expect(await opencodeExecutor.isAvailable()).toBe(false);

    mockSpawnScript({ stdout: ['  \n'], exitCode: 0 });
    expect(await opencodeExecutor.isAvailable()).toBe(false);
  });

  it('is false when spawn itself fails', async () => {
    mockSpawnScript({ error: new Error('spawn ENOENT') });

    expect(await opencodeExecutor.isAvailable()).toBe(false);
  });
});

describe('opencodeExecutor.run', () => {
  it('builds the opencode CLI command with model, title, dir, and a trailing prompt', async () => {
    mockSpawnScript({ stdout: ['{"ok":true}'], exitCode: 0 });
    const cwd = tmpdir();

    const result = await opencodeExecutor.run({
      instructions: 'Apply the fix.',
      task: 'fix-bug',
      confirmed: true,
      constraints: ['no new deps', 'keep tests green'],
      context: { file: 'a.ts' },
      cwd,
      model: 'glm-5.2',
      title: 'Fix bug',
    });

    const [command, args, options] = cp.spawn.mock.calls[0] as [string, string[], Record<string, unknown>];
    expect(command).toBe('opencode');
    expect(args.slice(0, 3)).toEqual(['run', '--format', 'json']);
    expect(args[3]).toBe('--file');
    expect(args[4]).toBe(capturedContextPath);
    expect(args.slice(5, 11)).toEqual(['--model', 'glm-5.2', '--title', 'Fix bug', '--dir', cwd]);
    expect(options).toEqual({ cwd, stdio: ['pipe', 'pipe', 'pipe'] });

    const prompt = args.at(-1) ?? '';
    expect(prompt).toContain('Apply the fix.');
    expect(prompt).toContain(`Context bundle: ${capturedContextPath}`);
    expect(prompt).toContain('Constraints:');
    expect(prompt).toContain('- no new deps');
    expect(prompt).toContain('- keep tests green');

    expect(result.command).toEqual(['opencode', ...args]);
    expect(result).toMatchObject({
      exitCode: 0,
      model: 'glm-5.2',
      provider: 'opencode',
      stderr: '',
      stdout: '{"ok":true}',
    });
    expect(Number.isInteger(result.durationMs)).toBe(true);
  });

  it('writes the context bundle as pretty JSON with constraints, context, and task', async () => {
    mockSpawnScript({ exitCode: 0 });

    await opencodeExecutor.run({
      instructions: 'Apply the fix.',
      task: 'fix-bug',
      confirmed: true,
      constraints: ['no new deps'],
      context: { file: 'a.ts' },
    });

    expect(JSON.parse(capturedContextFile ?? '')).toEqual({
      constraints: ['no new deps'],
      context: { file: 'a.ts' },
      task: 'fix-bug',
    });
  });

  it('omits optional flags and the constraints block for a minimal plan', async () => {
    mockSpawnScript({ exitCode: 0 });

    await opencodeExecutor.run({ instructions: 'Just do it.', task: 'minimal', confirmed: true });

    const [, args] = cp.spawn.mock.calls[0] as [string, string[]];
    expect(args).toHaveLength(6); // run --format json --file <path> <prompt>
    expect(args).not.toContain('--model');
    expect(args).not.toContain('--title');
    expect(args).not.toContain('--dir');
    expect(args.at(-1)).not.toContain('Constraints:');
    expect(JSON.parse(capturedContextFile ?? '')).toEqual({
      constraints: [],
      context: null,
      task: 'minimal',
    });
  });

  it('accumulates stdout and stderr chunks and defaults a null exit code to 1', async () => {
    mockSpawnScript({ stdout: ['part-1 ', 'part-2'], stderr: ['warn-1 ', 'warn-2'], exitCode: null });

    const result = await opencodeExecutor.run({ instructions: 'i', task: 't', confirmed: true });

    expect(result.stdout).toBe('part-1 part-2');
    expect(result.stderr).toBe('warn-1 warn-2');
    expect(result.exitCode).toBe(1);
  });

  it('removes the temp context dir after a successful run', async () => {
    mockSpawnScript({ exitCode: 0 });

    await opencodeExecutor.run({ instructions: 'i', task: 't', confirmed: true });

    expect(capturedContextPath).toBeDefined();
    expect(existsSync(dirname(String(capturedContextPath)))).toBe(false);
  });

  it('removes the temp context dir when the process fails to spawn', async () => {
    mockSpawnScript({ error: new Error('spawn ENOENT') });

    await expect(opencodeExecutor.run({ instructions: 'i', task: 't', confirmed: true })).rejects.toThrow(
      'spawn ENOENT',
    );

    expect(capturedContextPath).toBeDefined();
    expect(existsSync(dirname(String(capturedContextPath)))).toBe(false);
  });
});

describe('getExecutorStatus', () => {
  it('reports the opencode executor with availability and confirmation requirement', async () => {
    mockSpawnScript({ stdout: ['/usr/local/bin/opencode\n'], exitCode: 0 });

    expect(await getExecutorStatus()).toEqual([
      {
        available: true,
        capabilities: ['code_edit', 'shell_exec', 'test_run'],
        displayName: 'OpenCode',
        provider: 'opencode',
        requiresConfirmation: true,
      },
    ]);
  });
});
