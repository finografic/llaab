import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AI_SDK_MAX_RETRIES, resolveAiSdkModel, toProviderResult } from './ai-sdk-model-registry.js';

/**
 * Tests for the internal AI SDK boundary (Fable migration A1). The generateText round-trips run
 * against a mocked global fetch through the real openai-compatible provider — they double as the
 * migration doc's Phase 0 "mocked OpenAI-compatible endpoint" verification and pin that transport
 * retries stay disabled (retry multiplication is the migration's top documented risk).
 */

const fetchMock = vi.fn();

const OPENAI_CHAT_FIXTURE = {
  id: 'chatcmpl-1',
  object: 'chat.completion',
  created: 1753300000,
  model: 'model-x',
  choices: [
    {
      index: 0,
      message: { role: 'assistant', content: 'ai-sdk-response' },
      finish_reason: 'stop',
    },
  ],
  usage: { prompt_tokens: 8, completion_tokens: 3, total_tokens: 11 },
};

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('LLAAB_LMSTUDIO_BASE_URL', undefined);
  vi.stubEnv('LLAAB_LMSTUDIO_API_KEY', undefined);
  vi.stubEnv('OPENCODE_BASE_URL', undefined);
  vi.stubEnv('OPENCODE_API_KEY', 'oc-key');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('resolveAiSdkModel', () => {
  it('builds provider-scoped models carrying the requested model id', () => {
    const anthropic = resolveAiSdkModel('anthropic', 'claude-x');
    const lmstudio = resolveAiSdkModel('lmstudio', 'gemma-local');
    const opencode = resolveAiSdkModel('opencode', 'glm-5.2');

    expect(typeof anthropic).not.toBe('string');
    expect(typeof lmstudio).not.toBe('string');
    expect(typeof opencode).not.toBe('string');
    if (typeof anthropic === 'string' || typeof lmstudio === 'string' || typeof opencode === 'string') {
      throw new Error('expected model instances, not global model id strings');
    }
    expect(anthropic.modelId).toBe('claude-x');
    expect(anthropic.provider).toContain('anthropic');
    expect(lmstudio.modelId).toBe('gemma-local');
    expect(lmstudio.provider).toContain('lmstudio');
    expect(opencode.modelId).toBe('glm-5.2');
    expect(opencode.provider).toContain('opencode');
  });
});

describe('generateText through the openai-compatible boundary', () => {
  it('POSTs the LM Studio chat completions URL and maps text and usage', async () => {
    const { generateText } = await import('ai');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(OPENAI_CHAT_FIXTURE), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    const startedAt = performance.now();
    const result = await generateText({
      model: resolveAiSdkModel('lmstudio', 'model-x'),
      prompt: 'the prompt',
      maxRetries: AI_SDK_MAX_RETRIES,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input] = fetchMock.mock.calls[0] as [unknown];
    const url = input instanceof Request ? input.url : String(input);
    expect(url).toBe('http://localhost:1234/v1/chat/completions');

    const mapped = toProviderResult({
      text: result.text,
      usage: result.usage,
      providerId: 'lmstudio',
      model: 'model-x',
      startedAt,
    });
    expect(mapped).toMatchObject({
      text: 'ai-sdk-response',
      providerId: 'lmstudio',
      model: 'model-x',
      promptTokens: 8,
      completionTokens: 3,
    });
    expect(Number.isInteger(mapped.durationMs)).toBe(true);
  });

  it('does not retry failed requests when maxRetries is AI_SDK_MAX_RETRIES', async () => {
    const { generateText } = await import('ai');
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { message: 'upstream unavailable' } }), { status: 503 }),
    );

    await expect(
      generateText({
        model: resolveAiSdkModel('opencode', 'glm-5.2'),
        prompt: 'p',
        maxRetries: AI_SDK_MAX_RETRIES,
      }),
    ).rejects.toThrow();

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('toProviderResult', () => {
  it('leaves token counts undefined when the SDK reports no usage', () => {
    const mapped = toProviderResult({
      text: 't',
      usage: undefined,
      providerId: 'anthropic',
      model: 'claude-x',
      startedAt: performance.now(),
    });

    expect(mapped.promptTokens).toBeUndefined();
    expect(mapped.completionTokens).toBeUndefined();
  });
});
