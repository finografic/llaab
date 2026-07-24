import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Characterization tests for routing configuration (Fable migration A0): LLAAB_*_MODEL env
 * overrides and configs/llm-routing.json merge + persistence. Runs in a temp cwd because the
 * config path is resolved from process.cwd() at module load — the repo's real
 * configs/llm-routing.json must never be read or written by tests.
 */

const MODEL_ENV_VARS = [
  'LLAAB_LOCAL_SMALL_MODEL',
  'LLAAB_LOCAL_MID_MODEL',
  'LLAAB_LOCAL_STRONG_MODEL',
  'LLAAB_REMOTE_MODEL',
] as const;

let originalCwd: string;
let tempDir: string;

// process.chdir is legal here because the root vitest config uses the default forks pool;
// it would throw under pool: 'threads'.
beforeEach(() => {
  originalCwd = process.cwd();
  tempDir = mkdtempSync(join(tmpdir(), 'llaab-llm-config-'));
  process.chdir(tempDir);
  for (const envVar of MODEL_ENV_VARS) vi.stubEnv(envVar, undefined);
  vi.resetModules();
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(tempDir, { force: true, recursive: true });
  vi.unstubAllEnvs();
});

function importRouter() {
  return import('./router.js');
}

function writeRoutingFixture(config: unknown): void {
  mkdirSync(join(tempDir, 'configs'), { recursive: true });
  writeFileSync(join(tempDir, 'configs', 'llm-routing.json'), JSON.stringify(config, null, 2));
}

function readRoutingFile(): string {
  return readFileSync(join(tempDir, 'configs', 'llm-routing.json'), 'utf8');
}

describe('tier model map env overrides', () => {
  it('uses the documented defaults when no env overrides are set', async () => {
    const { resolveLlmRoute } = await importRouter();

    expect(resolveLlmRoute('format')).toEqual({
      model: 'llama3.2:3b',
      tier: 'local-small',
      provider: 'ollama',
    });
    expect(resolveLlmRoute('extract')).toEqual({
      model: 'llama3:latest',
      tier: 'local-mid',
      provider: 'ollama',
    });
    expect(resolveLlmRoute('consolidate')).toEqual({
      model: 'gpt-oss:20b',
      tier: 'local-strong',
      provider: 'ollama',
    });
    expect(resolveLlmRoute('reason-plus')).toEqual({
      model: 'claude-sonnet-4-6',
      tier: 'remote',
      provider: 'anthropic',
    });
  });

  it('honours LLAAB_LOCAL_SMALL_MODEL', async () => {
    vi.stubEnv('LLAAB_LOCAL_SMALL_MODEL', 'small-override');
    const { resolveLlmRoute } = await importRouter();

    expect(resolveLlmRoute('format').model).toBe('small-override');
  });

  it('honours LLAAB_LOCAL_MID_MODEL', async () => {
    vi.stubEnv('LLAAB_LOCAL_MID_MODEL', 'mid-override');
    const { resolveLlmRoute } = await importRouter();

    expect(resolveLlmRoute('extract').model).toBe('mid-override');
  });

  it('honours LLAAB_LOCAL_STRONG_MODEL', async () => {
    vi.stubEnv('LLAAB_LOCAL_STRONG_MODEL', 'strong-override');
    const { resolveLlmRoute } = await importRouter();

    expect(resolveLlmRoute('reason').model).toBe('strong-override');
  });

  it('honours LLAAB_REMOTE_MODEL', async () => {
    vi.stubEnv('LLAAB_REMOTE_MODEL', 'remote-override');
    const { resolveLlmRoute } = await importRouter();

    expect(resolveLlmRoute('reason-plus').model).toBe('remote-override');
  });
});

describe('configs/llm-routing.json merge', () => {
  it('overlays per-task overrides from the config file', async () => {
    writeRoutingFixture({ tasks: { extract: { provider: 'opencode', model: 'glm-5.2' } } });
    const { resolveLlmRoute } = await importRouter();

    expect(resolveLlmRoute('extract')).toEqual({
      model: 'glm-5.2',
      tier: 'local-mid',
      provider: 'opencode',
    });
  });

  it('keeps base tier and provider on a model-only override', async () => {
    writeRoutingFixture({ tasks: { consolidate: { model: 'custom-strong' } } });
    const { resolveLlmRoute } = await importRouter();

    expect(resolveLlmRoute('consolidate')).toEqual({
      model: 'custom-strong',
      tier: 'local-strong',
      provider: 'ollama',
    });
  });

  it('ignores invalid tier and provider values but takes the model verbatim', async () => {
    writeRoutingFixture({
      tasks: { extract: { tier: 'mega-tier', provider: 'gpt5', model: 'still-used' } },
    });
    const { resolveLlmRoute } = await importRouter();

    expect(resolveLlmRoute('extract')).toEqual({
      model: 'still-used',
      tier: 'local-mid',
      provider: 'ollama',
    });
  });

  it('ignores unknown task keys', async () => {
    writeRoutingFixture({ tasks: { 'not-a-task': { model: 'x' } } });
    const { resolveLlmRoute } = await importRouter();

    expect(resolveLlmRoute('extract').model).toBe('llama3:latest');
  });

  it('falls back to defaults when the config file is malformed', async () => {
    mkdirSync(join(tempDir, 'configs'), { recursive: true });
    writeFileSync(join(tempDir, 'configs', 'llm-routing.json'), '{ not json');
    const { resolveLlmRoute } = await importRouter();

    expect(resolveLlmRoute('extract')).toEqual({
      model: 'llama3:latest',
      tier: 'local-mid',
      provider: 'ollama',
    });
  });

  it('falls back to defaults when the config file is missing', async () => {
    const { resolveLlmRoute } = await importRouter();

    expect(resolveLlmRoute('extract').provider).toBe('ollama');
  });
});

describe('updateLlmTaskRoute persistence', () => {
  it('fills missing fields from the current route and writes the full TaskRoute', async () => {
    const { updateLlmTaskRoute } = await importRouter();

    const routing = updateLlmTaskRoute('extract', { provider: 'lmstudio' });

    expect(routing['extract']).toEqual({
      tier: 'local-mid',
      provider: 'lmstudio',
      model: 'llama3:latest',
    });
    expect(JSON.parse(readRoutingFile())).toEqual({
      tasks: {
        extract: { tier: 'local-mid', provider: 'lmstudio', model: 'llama3:latest' },
      },
    });
  });

  it('writes 2-space-indented JSON with a trailing newline', async () => {
    const { updateLlmTaskRoute } = await importRouter();

    updateLlmTaskRoute('format', { model: 'fmt-model' });

    const raw = readRoutingFile();
    expect(raw.endsWith('\n')).toBe(true);
    expect(raw).toBe(`${JSON.stringify(JSON.parse(raw), null, 2)}\n`);
  });

  it('creates the configs directory when missing', async () => {
    expect(existsSync(join(tempDir, 'configs'))).toBe(false);
    const { updateLlmTaskRoute } = await importRouter();

    updateLlmTaskRoute('extract', { model: 'x' });

    expect(existsSync(join(tempDir, 'configs', 'llm-routing.json'))).toBe(true);
  });

  it('preserves other tasks across successive updates', async () => {
    const { updateLlmTaskRoute } = await importRouter();

    updateLlmTaskRoute('extract', { provider: 'opencode', model: 'glm-5.2' });
    const routing = updateLlmTaskRoute('format', { model: 'fmt-model' });

    expect(routing['extract']).toEqual({
      tier: 'local-mid',
      provider: 'opencode',
      model: 'glm-5.2',
    });
    expect(routing['format']).toMatchObject({ model: 'fmt-model', provider: 'ollama' });
    expect(JSON.parse(readRoutingFile())).toEqual({
      tasks: {
        extract: { tier: 'local-mid', provider: 'opencode', model: 'glm-5.2' },
        format: { tier: 'local-small', provider: 'ollama', model: 'fmt-model' },
      },
    });
  });
});
