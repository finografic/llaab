import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Characterization tests for the Ollama provider transport (Fable migration A0). The `ollama`
 * SDK is mocked at module level; the lazy client and context-length cache are module singletons,
 * so each test re-imports a fresh module.
 */

const sdk = vi.hoisted(() => ({
  chat: vi.fn(),
  list: vi.fn(),
  show: vi.fn(),
  ctorArgs: [] as unknown[],
}));

vi.mock('ollama', () => ({
  Ollama: class {
    chat = sdk.chat;
    list = sdk.list;
    show = sdk.show;

    constructor(opts: unknown) {
      sdk.ctorArgs.push(opts);
    }
  },
}));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  sdk.ctorArgs.length = 0;
  vi.stubEnv('OLLAMA_HOST', undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

function importOllama() {
  return import('./ollama.js');
}

async function* chunksOf(chunks: Array<{ message?: { content?: string } }>) {
  for (const chunk of chunks) yield chunk;
}

async function collect(stream: AsyncGenerator<string>): Promise<string[]> {
  const results: string[] = [];
  for await (const chunk of stream) results.push(chunk);
  return results;
}

describe('ollamaComplete', () => {
  it('calls chat with a user-only message, stream false, and num_ctx 16384', async () => {
    const { ollamaComplete } = await importOllama();
    sdk.chat.mockResolvedValue({ message: { content: 'hi' }, prompt_eval_count: 11, eval_count: 4 });

    await ollamaComplete('the prompt', { model: 'model-x' });

    expect(sdk.chat).toHaveBeenCalledWith({
      model: 'model-x',
      messages: [{ role: 'user', content: 'the prompt' }],
      stream: false,
      options: { num_ctx: 16384 },
    });
  });

  it('prepends a system message when opts.system is set', async () => {
    const { ollamaComplete } = await importOllama();
    sdk.chat.mockResolvedValue({ message: { content: 'hi' } });

    await ollamaComplete('the prompt', { model: 'model-x', system: 'be terse' });

    expect(sdk.chat).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [
          { role: 'system', content: 'be terse' },
          { role: 'user', content: 'the prompt' },
        ],
      }),
    );
  });

  it('sets num_predict only when maxTokens is provided', async () => {
    const { ollamaComplete } = await importOllama();
    sdk.chat.mockResolvedValue({ message: { content: 'hi' } });

    await ollamaComplete('p', { model: 'model-x', maxTokens: 256 });

    expect(sdk.chat).toHaveBeenCalledWith(
      expect.objectContaining({ options: { num_ctx: 16384, num_predict: 256 } }),
    );
  });

  it('maps the response onto LlmProviderResult', async () => {
    const { ollamaComplete } = await importOllama();
    sdk.chat.mockResolvedValue({ message: { content: 'hi' }, prompt_eval_count: 11, eval_count: 4 });

    const result = await ollamaComplete('p', { model: 'model-x' });

    expect(result).toMatchObject({
      text: 'hi',
      providerId: 'ollama',
      model: 'model-x',
      promptTokens: 11,
      completionTokens: 4,
    });
    expect(Number.isInteger(result.durationMs)).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe('ollamaStream', () => {
  it('streams with stream true and yields only non-empty message content', async () => {
    const { ollamaStream } = await importOllama();
    sdk.chat.mockResolvedValue(
      chunksOf([
        { message: { content: 'a' } },
        { message: { content: '' } },
        { message: {} },
        { message: { content: 'b' } },
      ]),
    );

    const chunks = await collect(ollamaStream('p', { model: 'model-x' }));

    expect(chunks).toEqual(['a', 'b']);
    expect(sdk.chat).toHaveBeenCalledWith(
      expect.objectContaining({ stream: true, options: { num_ctx: 16384 } }),
    );
  });
});

describe('client construction', () => {
  it('defaults the host to http://localhost:11434', async () => {
    const { ollamaListModels } = await importOllama();
    sdk.list.mockResolvedValue({ models: [] });

    await ollamaListModels();

    expect(sdk.ctorArgs).toEqual([{ host: 'http://localhost:11434' }]);
  });

  it('honours OLLAMA_HOST', async () => {
    vi.stubEnv('OLLAMA_HOST', 'http://ollama-box:11500');
    const { ollamaListModels } = await importOllama();
    sdk.list.mockResolvedValue({ models: [] });

    await ollamaListModels();

    expect(sdk.ctorArgs).toEqual([{ host: 'http://ollama-box:11500' }]);
  });
});

describe('model listing and context length', () => {
  it('ollamaListModels maps model names', async () => {
    const { ollamaListModels } = await importOllama();
    sdk.list.mockResolvedValue({ models: [{ name: 'm1' }, { name: 'm2' }] });

    expect(await ollamaListModels()).toEqual(['m1', 'm2']);
  });

  it('derives context length from the architecture-specific model_info key and caches it', async () => {
    const { ollamaGetModelContextLength } = await importOllama();
    sdk.show.mockResolvedValue({
      model_info: { 'general.architecture': 'llama', 'llama.context_length': 8192 },
    });

    expect(await ollamaGetModelContextLength('model-x')).toBe(8192);
    expect(await ollamaGetModelContextLength('model-x')).toBe(8192);
    expect(sdk.show).toHaveBeenCalledTimes(1);
  });

  it('caches undefined when show fails', async () => {
    const { ollamaGetModelContextLength } = await importOllama();
    sdk.show.mockRejectedValue(new Error('no such model'));

    expect(await ollamaGetModelContextLength('model-x')).toBeUndefined();
    expect(await ollamaGetModelContextLength('model-x')).toBeUndefined();
    expect(sdk.show).toHaveBeenCalledTimes(1);
  });
});

describe('ollamaProvider.isAvailable', () => {
  it('returns true when the model list resolves', async () => {
    const { ollamaProvider } = await importOllama();
    sdk.list.mockResolvedValue({ models: [{ name: 'm1' }] });
    sdk.show.mockResolvedValue({});

    expect(await ollamaProvider.isAvailable()).toBe(true);
  });

  it('returns false when the list call rejects', async () => {
    const { ollamaProvider } = await importOllama();
    sdk.list.mockRejectedValue(new Error('connection refused'));

    expect(await ollamaProvider.isAvailable()).toBe(false);
  });
});
