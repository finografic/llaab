import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Characterization tests for the LM Studio provider transport (Fable migration A0): the
 * `lms` CLI model-lifecycle preflight, the OpenAI-compatible /chat/completions call, timeout
 * selection, and the progress lifecycle. The CLI is mocked through node:child_process —
 * lmstudio.ts runs promisify(execFile) at module load, so the execFile mock must carry the
 * promisify custom symbol. HTTP is mocked at global fetch.
 */

const cli = vi.hoisted(() => {
  const execFileAsync = vi.fn();
  const execFile = Object.assign(vi.fn(), {
    [Symbol.for('nodejs.util.promisify.custom')]: execFileAsync,
  });
  return { execFile, execFileAsync };
});

vi.mock('node:child_process', () => ({ execFile: cli.execFile }));

import { lmStudioComplete, lmStudioListModels, lmStudioProvider, lmStudioStream } from './lmstudio.js';

const fetchMock = vi.fn();

const CHAT_FIXTURE = {
  choices: [{ message: { content: 'lm-response' } }],
  usage: { prompt_tokens: 12, completion_tokens: 6 },
};

/** Mutable per-test state consumed by the default execFileAsync implementation. */
let loadedModels: unknown[] = [];
let cliModels: unknown[] = [];

let timeoutSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchMock.mockReset();
  cli.execFileAsync.mockReset();
  loadedModels = [];
  cliModels = [];

  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('LLAAB_LMSTUDIO_BASE_URL', undefined);
  vi.stubEnv('LLAAB_LMSTUDIO_CLI_PATH', '/fake/lms');
  vi.stubEnv('LLAAB_LMSTUDIO_API_KEY', undefined);
  vi.stubEnv('LLAAB_LMSTUDIO_TEMPERATURE', undefined);
  vi.stubEnv('LLAAB_LMSTUDIO_COMPLETION_TIMEOUT_MS', undefined);

  timeoutSpy = vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => new AbortController().signal);

  cli.execFileAsync.mockImplementation(async (_cliPath: string, args: string[]) => {
    if (args[0] === 'ps' && args[1] === '--json') return { stdout: JSON.stringify(loadedModels), stderr: '' };
    if (args[0] === 'ps') return { stdout: '', stderr: '' };
    if (args[0] === 'unload' || args[0] === 'load') return { stdout: '', stderr: '' };
    if (args[0] === 'ls') return { stdout: JSON.stringify(cliModels), stderr: '' };
    throw new Error(`unexpected lms invocation: ${args.join(' ')}`);
  });

  fetchMock.mockImplementation(async (input: unknown) => {
    const url = String(input);
    if (url.includes('/chat/completions')) {
      return new Response(JSON.stringify(CHAT_FIXTURE), { status: 200 });
    }
    if (url.includes('/models')) {
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
});

afterEach(() => {
  timeoutSpy.mockRestore();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

function lmsCalls(subcommand?: string): Array<[string, string[], Record<string, unknown>]> {
  const calls = cli.execFileAsync.mock.calls as Array<[string, string[], Record<string, unknown>]>;
  if (!subcommand) return calls;
  return calls.filter(([, args]) => args[0] === subcommand);
}

function barePsCalls(): Array<[string, string[], Record<string, unknown>]> {
  return lmsCalls('ps').filter(([, args]) => args[1] !== '--json');
}

function capturedFetch(index = 0): { url: string; init: RequestInit; body: Record<string, unknown> } {
  const [input, init] = fetchMock.mock.calls[index] as [unknown, RequestInit];
  return {
    url: String(input),
    init,
    body: init.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {},
  };
}

describe('model lifecycle preflight', () => {
  it('skips unload and load when the requested model is already loaded', async () => {
    loadedModels = [{ identifier: 'model-x' }];

    await lmStudioComplete('p', { model: 'model-x' });

    expect(lmsCalls('unload')).toHaveLength(0);
    expect(lmsCalls('load')).toHaveLength(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('matches a loaded model by trailing path segment in either direction', async () => {
    loadedModels = [{ modelKey: 'org/model-x' }];
    await lmStudioComplete('p', { model: 'model-x' });
    expect(lmsCalls('load')).toHaveLength(0);

    loadedModels = [{ identifier: 'model-y' }];
    await lmStudioComplete('p', { model: 'org/model-y' });
    expect(lmsCalls('load')).toHaveLength(0);
  });

  it('loads without unloading when nothing is loaded', async () => {
    loadedModels = [];

    await lmStudioComplete('p', { model: 'model-x' });

    expect(lmsCalls('unload')).toHaveLength(0);
    const loads = lmsCalls('load');
    expect(loads).toHaveLength(1);
    expect(loads[0]?.[0]).toBe('/fake/lms');
    expect(loads[0]?.[1]).toEqual(['load', 'model-x', '--yes']);
    expect(loads[0]?.[2]).toMatchObject({ timeout: 5 * 60 * 1000 });
    const psJson = lmsCalls('ps');
    expect(psJson[0]?.[2]).toMatchObject({ timeout: 5000, maxBuffer: 1024 * 1024 });
  });

  it('unloads all models first when a different model is loaded', async () => {
    loadedModels = [{ identifier: 'other-model' }];

    await lmStudioComplete('p', { model: 'model-x' });

    const unloads = lmsCalls('unload');
    expect(unloads).toHaveLength(1);
    expect(unloads[0]?.[1]).toEqual(['unload', '--all']);
    expect(unloads[0]?.[2]).toMatchObject({ timeout: 30000 });
    expect(lmsCalls('load')[0]?.[1]).toEqual(['load', 'model-x', '--yes']);
  });

  it('applies context-length and parallel load overrides for the pinned gemma model', async () => {
    loadedModels = [];

    await lmStudioComplete('p', { model: 'google/gemma-4-26b-a4b-qat' });

    expect(lmsCalls('load')[0]?.[1]).toEqual([
      'load',
      'google/gemma-4-26b-a4b-qat',
      '--yes',
      '--context-length',
      '32768',
      '--parallel',
      '2',
    ]);
  });
});

describe('completion request shape', () => {
  it('POSTs the default base URL with content-type only and temperature 0.3', async () => {
    loadedModels = [{ identifier: 'model-x' }];

    await lmStudioComplete('the prompt', { model: 'model-x' });

    const { url, init, body } = capturedFetch();
    expect(url).toBe('http://localhost:1234/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(body).toEqual({
      model: 'model-x',
      messages: [{ role: 'user', content: 'the prompt' }],
      temperature: 0.3,
    });
  });

  it('includes a system message and max_tokens when provided', async () => {
    loadedModels = [{ identifier: 'model-x' }];

    await lmStudioComplete('p', { model: 'model-x', system: 'be terse', maxTokens: 64 });

    const { body } = capturedFetch();
    expect(body['messages']).toEqual([
      { role: 'system', content: 'be terse' },
      { role: 'user', content: 'p' },
    ]);
    expect(body['max_tokens']).toBe(64);
  });

  it('honours base URL (trailing slash stripped), API key, and temperature env overrides', async () => {
    vi.stubEnv('LLAAB_LMSTUDIO_BASE_URL', 'http://studio-host:9999/v1/');
    vi.stubEnv('LLAAB_LMSTUDIO_API_KEY', 'lm-key');
    vi.stubEnv('LLAAB_LMSTUDIO_TEMPERATURE', '0.9');
    loadedModels = [{ identifier: 'model-x' }];

    await lmStudioComplete('p', { model: 'model-x' });

    const { url, init, body } = capturedFetch();
    expect(url).toBe('http://studio-host:9999/v1/chat/completions');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      'Authorization': 'Bearer lm-key',
    });
    expect(body['temperature']).toBe(0.9);
  });

  it('maps text and usage onto LlmProviderResult', async () => {
    loadedModels = [{ identifier: 'model-x' }];

    const result = await lmStudioComplete('p', { model: 'model-x' });

    expect(result).toMatchObject({
      text: 'lm-response',
      providerId: 'lmstudio',
      model: 'model-x',
      promptTokens: 12,
      completionTokens: 6,
    });
    expect(Number.isInteger(result.durationMs)).toBe(true);
  });
});

describe('timeout selection', () => {
  it('uses the 20-minute default for /chat/completions and honours the env override', async () => {
    loadedModels = [{ identifier: 'model-x' }];

    await lmStudioComplete('p', { model: 'model-x' });
    expect(timeoutSpy).toHaveBeenLastCalledWith(20 * 60 * 1000);

    vi.stubEnv('LLAAB_LMSTUDIO_COMPLETION_TIMEOUT_MS', '5000');
    await lmStudioComplete('p', { model: 'model-x' });
    expect(timeoutSpy).toHaveBeenLastCalledWith(5000);
  });

  it('falls back to the default when the timeout env value is not plain digits', async () => {
    vi.stubEnv('LLAAB_LMSTUDIO_COMPLETION_TIMEOUT_MS', '1_200_000');
    loadedModels = [{ identifier: 'model-x' }];

    await lmStudioComplete('p', { model: 'model-x' });

    expect(timeoutSpy).toHaveBeenLastCalledWith(20 * 60 * 1000);
  });

  it('uses the 30-second API timeout for /models', async () => {
    await lmStudioListModels();

    expect(timeoutSpy).toHaveBeenCalledWith(30 * 1000);
  });
});

describe('error mapping', () => {
  it('includes the response body in the failure message when present', async () => {
    loadedModels = [{ identifier: 'model-x' }];
    fetchMock.mockResolvedValue(new Response('boom', { status: 500 }));

    await expect(lmStudioComplete('p', { model: 'model-x' })).rejects.toThrow(
      'LM Studio request failed: 500 boom',
    );
  });

  it('omits the body from the failure message when empty', async () => {
    loadedModels = [{ identifier: 'model-x' }];
    fetchMock.mockResolvedValue(new Response('', { status: 502 }));

    await expect(lmStudioComplete('p', { model: 'model-x' })).rejects.toThrow(
      'LM Studio request failed: 502',
    );
  });

  it('throws when the response has no message content', async () => {
    loadedModels = [{ identifier: 'model-x' }];
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 }));

    await expect(lmStudioComplete('p', { model: 'model-x' })).rejects.toThrow(
      'Unexpected response from LM Studio',
    );
  });
});

describe('progress lifecycle', () => {
  it('reports loading, processing prompt, then completed with completion tokens', async () => {
    loadedModels = [{ identifier: 'model-x' }];
    const onProgress = vi.fn();

    await lmStudioComplete('p', { model: 'model-x', onProgress });

    expect(onProgress.mock.calls).toEqual([
      [{ status: 'loading' }],
      [{ status: 'processing prompt' }],
      [{ status: 'completed', completionTokens: 6 }],
    ]);
  });

  it('does not poll lms ps when onProgress is omitted', async () => {
    loadedModels = [{ identifier: 'model-x' }];

    await lmStudioComplete('p', { model: 'model-x' });

    expect(barePsCalls()).toHaveLength(0);
  });

  it('stops progress polling when the completion request fails', async () => {
    vi.useFakeTimers();
    loadedModels = [{ identifier: 'model-x' }];
    fetchMock.mockRejectedValue(new Error('connection reset'));
    const onProgress = vi.fn();

    await expect(lmStudioComplete('p', { model: 'model-x', onProgress })).rejects.toThrow('connection reset');

    const pollsAfterFailure = barePsCalls().length;
    await vi.advanceTimersByTimeAsync(10_000);
    expect(barePsCalls()).toHaveLength(pollsAfterFailure);
  });
});

describe('lmStudioStream', () => {
  // Current behaviour — single-chunk pseudo-stream. Scheduled to be superseded by real
  // streaming in migration phase A3; replacing this test there is the sanctioned exception.
  it('yields the full completion as a single chunk', async () => {
    loadedModels = [{ identifier: 'model-x' }];

    const chunks: string[] = [];
    for await (const chunk of lmStudioStream('p', { model: 'model-x' })) chunks.push(chunk);

    expect(chunks).toEqual(['lm-response']);
  });
});

describe('lmStudioListModels', () => {
  it('filters embedding models by CLI domain and by id substring', async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ data: [{ id: 'chat-1' }, { id: 'nomic-embedding-v1' }, { id: 'cli-embed' }] }),
          { status: 200 },
        ),
    );
    cliModels = [{ modelKey: 'cli-embed', type: 'embedding' }];

    expect(await lmStudioListModels()).toEqual(['chat-1']);
  });

  it('falls back to the HTTP list when the CLI is unavailable', async () => {
    fetchMock.mockImplementation(
      async () =>
        new Response(
          JSON.stringify({ data: [{ id: 'chat-1' }, { id: 'nomic-embedding-v1' }, { id: 'cli-embed' }] }),
          { status: 200 },
        ),
    );
    cli.execFileAsync.mockRejectedValue(new Error('lms not installed'));

    expect(await lmStudioListModels()).toEqual(['chat-1', 'cli-embed']);
  });
});

describe('lmStudioProvider.isAvailable', () => {
  it('returns false when the HTTP API is unreachable', async () => {
    fetchMock.mockRejectedValue(new Error('connection refused'));

    expect(await lmStudioProvider.isAvailable()).toBe(false);
  });

  it('returns true when the model list resolves', async () => {
    expect(await lmStudioProvider.isAvailable()).toBe(true);
  });
});
