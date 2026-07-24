import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

/**
 * Tests for routeLlmObject (Fable migration A4): the AI SDK Output.object path for
 * anthropic/opencode routes (exercised at the fetch boundary) and the deterministic
 * text-plus-JSON-extraction fallback for local providers (exercised with a faked ollama
 * provider module).
 */

const fakes = vi.hoisted(() => ({
  ollama: {
    id: 'ollama',
    displayName: 'Ollama',
    capabilities: ['chat', 'summarize', 'extract', 'reduce', 'structure'],
    complete: vi.fn(),
    stream: vi.fn(),
    isAvailable: vi.fn(),
  },
}));

vi.mock('./providers/ollama.js', () => ({
  ollamaProvider: fakes.ollama,
  ollamaComplete: vi.fn(),
  ollamaStream: vi.fn(),
  ollamaListModels: vi.fn(),
  ollamaListModelDetails: vi.fn(),
  ollamaGetModelContextLength: vi.fn(),
}));

const ANSWER_SCHEMA = z.object({ answer: z.number() });

const fetchMock = vi.fn();

let originalCwd: string;
let tempDir: string;

// process.chdir is legal here because the root vitest config uses the default forks pool.
beforeEach(() => {
  originalCwd = process.cwd();
  tempDir = mkdtempSync(join(tmpdir(), 'llaab-llm-object-'));
  process.chdir(tempDir);
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('OPENCODE_API_KEY', 'oc-key');
  vi.stubEnv('LLAAB_LOCAL_STRONG_MODEL', undefined);
});

afterEach(() => {
  process.chdir(originalCwd);
  rmSync(tempDir, { force: true, recursive: true });
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function importRouter() {
  return import('./router.js');
}

function routeWikiLinkToOpenCode(): void {
  mkdirSync(join(tempDir, 'configs'), { recursive: true });
  writeFileSync(
    join(tempDir, 'configs', 'llm-routing.json'),
    JSON.stringify({ tasks: { 'wiki-link': { provider: 'opencode', model: 'glm-5.2' } } }, null, 2),
  );
}

function openAiChatResponse(content: string): Response {
  return new Response(
    JSON.stringify({
      id: 'c1',
      object: 'chat.completion',
      created: 1,
      model: 'glm-5.2',
      choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
      usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

describe('routeLlmObject — ai-sdk path (opencode route)', () => {
  it('returns the typed object with provider/model/usage metadata', async () => {
    routeWikiLinkToOpenCode();
    fetchMock.mockResolvedValue(openAiChatResponse('{"answer":42}'));
    const { routeLlmObject } = await importRouter();

    const result = await routeLlmObject('wiki-link', 'the prompt', ANSWER_SCHEMA);

    expect(result.object).toEqual({ answer: 42 });
    expect(result.rawText).toBe('{"answer":42}');
    expect(result).toMatchObject({
      model: 'glm-5.2',
      provider: 'opencode',
      promptTokens: 8,
      completionTokens: 3,
    });
    expect(Number.isInteger(result.durationMs)).toBe(true);
  });

  it('throws before any fetch when OPENCODE_API_KEY is missing', async () => {
    routeWikiLinkToOpenCode();
    vi.stubEnv('OPENCODE_API_KEY', undefined);
    const { routeLlmObject } = await importRouter();

    await expect(routeLlmObject('wiki-link', 'p', ANSWER_SCHEMA)).rejects.toThrow(
      'OPENCODE_API_KEY is not configured',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('wraps schema-invalid output in LlmStructuredOutputError with the raw text preserved', async () => {
    routeWikiLinkToOpenCode();
    fetchMock.mockResolvedValue(openAiChatResponse('{"answer":"not-a-number"}'));
    const { LlmStructuredOutputError, routeLlmObject } = await importRouter();

    const failure = await routeLlmObject('wiki-link', 'p', ANSWER_SCHEMA).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(LlmStructuredOutputError);
    expect((failure as InstanceType<typeof LlmStructuredOutputError>).rawText).toBe(
      '{"answer":"not-a-number"}',
    );
  });

  it('maps transport failures onto the OpenCode error contract', async () => {
    routeWikiLinkToOpenCode();
    fetchMock.mockResolvedValue(new Response('upstream down', { status: 503 }));
    const { routeLlmObject } = await importRouter();

    await expect(routeLlmObject('wiki-link', 'p', ANSWER_SCHEMA)).rejects.toThrow(
      'OpenCode request failed: 503 upstream down',
    );
  });
});

describe('routeLlmObject — local fallback path (default ollama route)', () => {
  function completeWith(text: string): void {
    fakes.ollama.complete.mockResolvedValue({
      text,
      durationMs: 42,
      providerId: 'ollama',
      model: 'gpt-oss:20b',
      promptTokens: 7,
      completionTokens: 3,
    });
  }

  it('extracts fenced JSON from local model output and validates it', async () => {
    completeWith('Here you go:\n```json\n{"answer": 7}\n```\nDone.');
    const { routeLlmObject } = await importRouter();

    const result = await routeLlmObject('wiki-link', 'p', ANSWER_SCHEMA, { system: 's', maxTokens: 64 });

    expect(result.object).toEqual({ answer: 7 });
    expect(result).toMatchObject({
      provider: 'ollama',
      model: 'gpt-oss:20b',
      durationMs: 42,
      promptTokens: 7,
      completionTokens: 3,
    });
    expect(result.rawText).toContain('```json');
    expect(fakes.ollama.complete).toHaveBeenCalledWith('p', {
      model: 'gpt-oss:20b',
      system: 's',
      maxTokens: 64,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('extracts a bare JSON object surrounded by prose', async () => {
    completeWith('The result is {"answer": 3} as requested.');
    const { routeLlmObject } = await importRouter();

    expect((await routeLlmObject('wiki-link', 'p', ANSWER_SCHEMA)).object).toEqual({ answer: 3 });
  });

  it('throws LlmStructuredOutputError when no JSON object is present', async () => {
    completeWith('I cannot answer that.');
    const { LlmStructuredOutputError, routeLlmObject } = await importRouter();

    const failure = await routeLlmObject('wiki-link', 'p', ANSWER_SCHEMA).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(LlmStructuredOutputError);
    expect((failure as InstanceType<typeof LlmStructuredOutputError>).message).toBe(
      'No JSON object found in model output',
    );
    expect((failure as InstanceType<typeof LlmStructuredOutputError>).rawText).toBe('I cannot answer that.');
  });

  it('throws LlmStructuredOutputError for malformed JSON', async () => {
    completeWith('{"answer": 7');
    const { LlmStructuredOutputError, routeLlmObject } = await importRouter();

    await expect(routeLlmObject('wiki-link', 'p', ANSWER_SCHEMA)).rejects.toBeInstanceOf(
      LlmStructuredOutputError,
    );
  });

  it('throws LlmStructuredOutputError when the object fails schema validation', async () => {
    completeWith('{"answer": "seven"}');
    const { LlmStructuredOutputError, routeLlmObject } = await importRouter();

    const failure = await routeLlmObject('wiki-link', 'p', ANSWER_SCHEMA).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(LlmStructuredOutputError);
    expect((failure as InstanceType<typeof LlmStructuredOutputError>).message).toBe(
      'Model output failed schema validation',
    );
  });

  it('propagates provider transport errors unchanged', async () => {
    fakes.ollama.complete.mockRejectedValue(new Error('connection refused'));
    const { routeLlmObject } = await importRouter();

    await expect(routeLlmObject('wiki-link', 'p', ANSWER_SCHEMA)).rejects.toThrow('connection refused');
  });
});
