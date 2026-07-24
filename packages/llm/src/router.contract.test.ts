import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Characterization tests for the routeLlm/streamLlm/getLlmStatus contract (Fable migration A0).
 * Providers are faked at the module boundary; cache.ts stays real. Behaviour pinned here must
 * survive the AI SDK transport migration unchanged.
 */

const fakes = vi.hoisted(() => {
  const makeProvider = (id: string, displayName: string, capabilities: string[]) => ({
    id,
    displayName,
    capabilities,
    complete: vi.fn(),
    stream: vi.fn(),
    isAvailable: vi.fn(),
  });

  return {
    ollama: makeProvider('ollama', 'Ollama', ['chat', 'summarize', 'extract', 'reduce', 'structure']),
    anthropic: makeProvider('anthropic', 'Anthropic', [
      'chat',
      'reason',
      'summarize',
      'extract',
      'structure',
      'plan',
    ]),
    lmstudio: makeProvider('lmstudio', 'LM Studio', ['chat', 'summarize', 'extract', 'reduce', 'structure']),
    opencode: makeProvider('opencode', 'OpenCode', [
      'chat',
      'reason',
      'summarize',
      'extract',
      'structure',
      'plan',
      'code_edit',
    ]),
  };
});

vi.mock('./providers/ollama.js', () => ({
  ollamaProvider: fakes.ollama,
  ollamaComplete: vi.fn(),
  ollamaStream: vi.fn(),
  ollamaListModels: vi.fn(),
  ollamaListModelDetails: vi.fn(),
  ollamaGetModelContextLength: vi.fn(),
}));
vi.mock('./providers/anthropic.js', () => ({
  anthropicProvider: fakes.anthropic,
  anthropicComplete: vi.fn(),
  anthropicStream: vi.fn(),
}));
vi.mock('./providers/lmstudio.js', () => ({
  lmStudioProvider: fakes.lmstudio,
  lmStudioComplete: vi.fn(),
  lmStudioStream: vi.fn(),
  lmStudioListModels: vi.fn(),
  lmStudioListModelDetails: vi.fn(),
}));
vi.mock('./providers/opencode.js', () => ({
  openCodeProvider: fakes.opencode,
  openCodeComplete: vi.fn(),
  openCodeStream: vi.fn(),
  openCodeListModels: vi.fn(),
  openCodeListModelDetails: vi.fn(),
  mapOpenCodeError: vi.fn((error: unknown) => (error instanceof Error ? error : new Error(String(error)))),
}));

const MODEL_ENV_VARS = [
  'LLAAB_LOCAL_SMALL_MODEL',
  'LLAAB_LOCAL_MID_MODEL',
  'LLAAB_LOCAL_STRONG_MODEL',
  'LLAAB_REMOTE_MODEL',
] as const;

// With env unset, the defaults in router.ts apply.
const DEFAULT_MID_MODEL = 'llama3:latest';
const DEFAULT_REMOTE_MODEL = 'claude-sonnet-4-6';

let originalCwd: string;
let tempDir: string;

// process.chdir is legal here because the root vitest config uses the default forks pool;
// it would throw under pool: 'threads'.
beforeEach(() => {
  originalCwd = process.cwd();
  tempDir = mkdtempSync(join(tmpdir(), 'llaab-llm-router-'));
  process.chdir(tempDir);
  for (const envVar of MODEL_ENV_VARS) vi.stubEnv(envVar, undefined);
  vi.resetModules();
  vi.clearAllMocks();

  fakes.ollama.complete.mockResolvedValue({
    text: 'ollama-text',
    durationMs: 42,
    providerId: 'ollama',
    model: 'ollama-reported-model',
    promptTokens: 7,
    completionTokens: 3,
  });
  fakes.anthropic.complete.mockResolvedValue({
    text: 'anthropic-text',
    durationMs: 55,
    providerId: 'anthropic',
    model: 'anthropic-reported-model',
    promptTokens: 11,
    completionTokens: 5,
  });
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(tempDir, { force: true, recursive: true });
  vi.unstubAllEnvs();
});

function importRouter() {
  return import('./router.js');
}

async function collect(stream: AsyncGenerator<string>): Promise<string[]> {
  const chunks: string[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  return chunks;
}

describe('routeLlm', () => {
  it('maps the provider result onto LlmCompleteResult on a cache miss', async () => {
    const { routeLlm } = await importRouter();

    const result = await routeLlm('extract', 'some prompt');

    expect(fakes.ollama.complete).toHaveBeenCalledTimes(1);
    expect(fakes.ollama.complete).toHaveBeenCalledWith('some prompt', {
      model: DEFAULT_MID_MODEL,
      system: undefined,
      maxTokens: undefined,
      bypassCache: undefined,
      onProgress: undefined,
    });
    // model/provider come from the provider result on a miss, not from route resolution.
    expect(result).toEqual({
      text: 'ollama-text',
      model: 'ollama-reported-model',
      cached: false,
      provider: 'ollama',
      durationMs: 42,
      promptTokens: 7,
      completionTokens: 3,
    });
  });

  it('forwards system, maxTokens, and onProgress to the provider', async () => {
    const { routeLlm } = await importRouter();
    const onProgress = vi.fn();

    await routeLlm('consolidate', 'p', { system: 'sys', maxTokens: 99, onProgress });

    expect(fakes.ollama.complete).toHaveBeenCalledWith('p', {
      model: 'gpt-oss:20b',
      system: 'sys',
      maxTokens: 99,
      bypassCache: undefined,
      onProgress,
    });
  });

  it('serves a cache hit for cacheable tasks with durationMs 0 and no token counts', async () => {
    const { routeLlm } = await importRouter();

    await routeLlm('extract', 'some prompt');
    const hit = await routeLlm('extract', 'some prompt');

    expect(fakes.ollama.complete).toHaveBeenCalledTimes(1);
    // On a hit, model/provider come from route resolution (requested model), not the provider result.
    expect(hit).toEqual({
      text: 'ollama-text',
      model: DEFAULT_MID_MODEL,
      cached: true,
      provider: 'ollama',
      durationMs: 0,
    });
    expect(hit.promptTokens).toBeUndefined();
    expect(hit.completionTokens).toBeUndefined();
  });

  it('serves a cache hit when system and maxTokens are unchanged', async () => {
    const { routeLlm } = await importRouter();

    await routeLlm('extract', 'p', { system: 'system A', maxTokens: 10 });
    const hit = await routeLlm('extract', 'p', { system: 'system A', maxTokens: 10 });

    expect(fakes.ollama.complete).toHaveBeenCalledTimes(1);
    expect(hit.cached).toBe(true);
  });

  it('includes system in the cache key, so a different system prompt misses', async () => {
    const { routeLlm } = await importRouter();

    await routeLlm('extract', 'p', { system: 'system A' });
    const miss = await routeLlm('extract', 'p', { system: 'system B' });

    expect(fakes.ollama.complete).toHaveBeenCalledTimes(2);
    expect(miss.cached).toBe(false);
  });

  it('includes maxTokens in the cache key, so a different token cap misses', async () => {
    const { routeLlm } = await importRouter();

    await routeLlm('extract', 'p', { maxTokens: 10 });
    const miss = await routeLlm('extract', 'p', { maxTokens: 999 });

    expect(fakes.ollama.complete).toHaveBeenCalledTimes(2);
    expect(miss.cached).toBe(false);
  });

  it('keys the cache per provider:model, so a model override misses', async () => {
    const { routeLlm } = await importRouter();

    await routeLlm('extract', 'p');
    await routeLlm('extract', 'p', { model: 'another-model' });

    expect(fakes.ollama.complete).toHaveBeenCalledTimes(2);
  });

  it('bypassCache skips both the cache read and the write — it never touches the cache', async () => {
    const { routeLlm } = await importRouter();

    await routeLlm('extract', 'p');
    fakes.ollama.complete.mockResolvedValue({
      text: 'fresh-text',
      durationMs: 10,
      providerId: 'ollama',
      model: DEFAULT_MID_MODEL,
    });

    const bypassed = await routeLlm('extract', 'p', { bypassCache: true });
    expect(bypassed.cached).toBe(false);
    expect(bypassed.text).toBe('fresh-text');
    expect(fakes.ollama.complete).toHaveBeenCalledTimes(2);

    // The bypassed call must not have overwritten the cache entry — a later non-bypassed call
    // still sees the original cached response, not whatever the bypassed call happened to return.
    const hit = await routeLlm('extract', 'p');
    expect(hit).toMatchObject({ cached: true, text: 'ollama-text' });
    expect(fakes.ollama.complete).toHaveBeenCalledTimes(2);
  });

  it('never caches non-cacheable tasks', async () => {
    const { routeLlm } = await importRouter();

    await routeLlm('consolidate', 'p');
    await routeLlm('consolidate', 'p');

    expect(fakes.ollama.complete).toHaveBeenCalledTimes(2);
  });

  it('propagates provider errors unwrapped and caches nothing', async () => {
    const { routeLlm } = await importRouter();
    fakes.ollama.complete.mockRejectedValueOnce(new Error('provider exploded'));

    await expect(routeLlm('extract', 'p')).rejects.toThrow('provider exploded');

    await routeLlm('extract', 'p');
    expect(fakes.ollama.complete).toHaveBeenCalledTimes(2);
  });

  it('a bare model override changes the model but keeps the routed provider', async () => {
    const { routeLlm } = await importRouter();

    // reason-plus routes to anthropic; a bare ollama-looking model override stays on anthropic.
    await routeLlm('reason-plus', 'p', { model: DEFAULT_MID_MODEL });

    expect(fakes.anthropic.complete).toHaveBeenCalledTimes(1);
    expect(fakes.ollama.complete).not.toHaveBeenCalled();
    expect(fakes.anthropic.complete).toHaveBeenCalledWith(
      'p',
      expect.objectContaining({ model: DEFAULT_MID_MODEL }),
    );
  });

  it('a provider:model override redirects both the provider and the model', async () => {
    const { routeLlm } = await importRouter();

    // reason-plus routes to anthropic by default; a provider-prefixed override redirects to ollama.
    await routeLlm('reason-plus', 'p', { model: `ollama:${DEFAULT_MID_MODEL}` });

    expect(fakes.ollama.complete).toHaveBeenCalledTimes(1);
    expect(fakes.anthropic.complete).not.toHaveBeenCalled();
    expect(fakes.ollama.complete).toHaveBeenCalledWith(
      'p',
      expect.objectContaining({ model: DEFAULT_MID_MODEL }),
    );
  });

  it('a colon-bearing model name that is not a recognized provider prefix stays bare', async () => {
    const { routeLlm } = await importRouter();

    // Real Ollama tags contain colons (e.g. "gemma4:e4b-it-qat") — these must not be
    // misparsed as a provider:model override.
    await routeLlm('extract', 'p', { model: 'gemma4:e4b-it-qat' });

    expect(fakes.ollama.complete).toHaveBeenCalledWith(
      'p',
      expect.objectContaining({ model: 'gemma4:e4b-it-qat' }),
    );
  });
});

describe('invalidateLlmCache', () => {
  it('evicts the cached response so the next call re-queries the provider', async () => {
    const { invalidateLlmCache, routeLlm } = await importRouter();

    await routeLlm('extract', 'p');
    invalidateLlmCache('extract', 'p');
    await routeLlm('extract', 'p');

    expect(fakes.ollama.complete).toHaveBeenCalledTimes(2);
  });

  it('honours the model override when resolving the key', async () => {
    const { invalidateLlmCache, routeLlm } = await importRouter();

    await routeLlm('extract', 'p', { model: 'custom-model' });
    invalidateLlmCache('extract', 'p', 'custom-model');
    await routeLlm('extract', 'p', { model: 'custom-model' });

    expect(fakes.ollama.complete).toHaveBeenCalledTimes(2);
  });

  it('is a no-op for non-cacheable tasks', async () => {
    const { invalidateLlmCache } = await importRouter();

    expect(() => invalidateLlmCache('consolidate', 'p')).not.toThrow();
  });
});

describe('resolveLlmRoute', () => {
  it('resolves the default route for a task', async () => {
    const { resolveLlmRoute } = await importRouter();

    expect(resolveLlmRoute('extract')).toEqual({
      model: DEFAULT_MID_MODEL,
      tier: 'local-mid',
      provider: 'ollama',
    });
    expect(resolveLlmRoute('reason-plus')).toEqual({
      model: DEFAULT_REMOTE_MODEL,
      tier: 'remote',
      provider: 'anthropic',
    });
  });

  it('a bare model override keeps the routed provider and tier', async () => {
    const { resolveLlmRoute } = await importRouter();

    expect(resolveLlmRoute('extract', 'claude-x')).toEqual({
      model: 'claude-x',
      tier: 'local-mid',
      provider: 'ollama',
    });
  });

  it('a provider:model override redirects the provider and keeps the routed tier', async () => {
    const { resolveLlmRoute } = await importRouter();

    expect(resolveLlmRoute('extract', 'anthropic:claude-x')).toEqual({
      model: 'claude-x',
      tier: 'local-mid',
      provider: 'anthropic',
    });
  });
});

describe('streamLlm', () => {
  it('delegates to the provider stream with resolved model and passthrough opts', async () => {
    const { streamLlm } = await importRouter();
    fakes.ollama.stream.mockImplementation(async function* () {
      yield 'chunk-1';
      yield 'chunk-2';
    });

    const chunks = await collect(streamLlm('extract', 'p', { system: 's', maxTokens: 5 }));

    expect(chunks).toEqual(['chunk-1', 'chunk-2']);
    expect(fakes.ollama.stream).toHaveBeenCalledWith('p', {
      model: DEFAULT_MID_MODEL,
      system: 's',
      maxTokens: 5,
    });
  });

  it('never reads or writes the response cache, even for cacheable tasks', async () => {
    const { routeLlm, streamLlm } = await importRouter();
    fakes.ollama.stream.mockImplementation(async function* () {
      yield 'streamed';
    });

    // routeLlm caches the response; streaming the same prompt still hits the provider.
    await routeLlm('extract', 'p');
    await collect(streamLlm('extract', 'p'));
    await collect(streamLlm('extract', 'p'));
    expect(fakes.ollama.stream).toHaveBeenCalledTimes(2);

    // And streaming did not overwrite the cached routeLlm response.
    const hit = await routeLlm('extract', 'p');
    expect(hit).toMatchObject({ cached: true, text: 'ollama-text' });
  });
});

describe('getLlmStatus', () => {
  it('reports availability, capabilities, modelMap, and routing', async () => {
    const { getLlmStatus } = await importRouter();
    fakes.ollama.isAvailable.mockResolvedValue(true);
    fakes.anthropic.isAvailable.mockResolvedValue(false);
    fakes.lmstudio.isAvailable.mockResolvedValue(true);
    fakes.opencode.isAvailable.mockResolvedValue(false);

    const status = await getLlmStatus();

    expect(status.availableProviders).toEqual(['ollama', 'lmstudio']);
    expect(status.capabilities.map((entry) => entry.provider)).toEqual([
      'ollama',
      'anthropic',
      'lmstudio',
      'opencode',
    ]);
    expect(status.capabilities[0]).toEqual({
      available: true,
      capabilities: fakes.ollama.capabilities,
      displayName: 'Ollama',
      provider: 'ollama',
    });
    expect(status.capabilities[1]).toMatchObject({ available: false, displayName: 'Anthropic' });
    expect(status.modelMap).toEqual({
      'local-small': 'llama3.2:3b',
      'local-mid': 'llama3:latest',
      'local-strong': 'gpt-oss:20b',
      'remote': 'claude-sonnet-4-6',
    });
    expect(status.routing['extract']).toEqual({
      tier: 'local-mid',
      model: DEFAULT_MID_MODEL,
      provider: 'ollama',
    });
    expect(status.routing['reason-plus']).toEqual({
      tier: 'remote',
      model: DEFAULT_REMOTE_MODEL,
      provider: 'anthropic',
    });
  });
});
