import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { openCodeComplete, openCodeProvider, openCodeStream } from './opencode.js';

/**
 * Characterization tests for the OpenCode provider transport (Fable migration A0): the
 * OpenAI-compatible chat call against the Zen gateway, auth handling, and error mapping.
 * HTTP is mocked at global fetch; env is read at call time so no module resets are needed.
 */

const fetchMock = vi.fn();

const CHAT_FIXTURE = {
  choices: [{ message: { content: 'oc-response' } }],
  usage: { prompt_tokens: 9, completion_tokens: 4 },
};

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(new Response(JSON.stringify(CHAT_FIXTURE), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('OPENCODE_API_KEY', 'oc-key');
  vi.stubEnv('OPENCODE_BASE_URL', undefined);
  vi.stubEnv('OPENCODE_TEMPERATURE', undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function capturedFetch(index = 0): {
  url: string;
  init: RequestInit;
  headers: Record<string, string>;
  body: Record<string, unknown>;
} {
  const [input, init] = fetchMock.mock.calls[index] as [unknown, RequestInit];
  // Header names are case-insensitive on the wire — normalize so the pin survives transports
  // that emit lowercase names (recorded in the migration ledger under Decisions).
  const headers: Record<string, string> = {};
  new Headers(init.headers).forEach((value, key) => {
    headers[key] = value;
  });
  return {
    url: String(input),
    init,
    headers,
    body: init.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : {},
  };
}

describe('openCodeComplete', () => {
  it('throws before any fetch when OPENCODE_API_KEY is missing', async () => {
    vi.stubEnv('OPENCODE_API_KEY', undefined);

    await expect(openCodeComplete('p', { model: 'glm-5.2' })).rejects.toThrow(
      'OPENCODE_API_KEY is not configured',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs the default Zen base URL with bearer auth and temperature 0.3', async () => {
    await openCodeComplete('the prompt', { model: 'glm-5.2' });

    const { url, init, headers, body } = capturedFetch();
    expect(url).toBe('https://opencode.ai/zen/go/v1/chat/completions');
    expect(init.method).toBe('POST');
    expect(headers['authorization']).toBe('Bearer oc-key');
    expect(headers['content-type']).toBe('application/json');
    expect(body).toEqual({
      model: 'glm-5.2',
      messages: [{ role: 'user', content: 'the prompt' }],
      temperature: 0.3,
    });
  });

  it('honours OPENCODE_BASE_URL with a trailing slash and OPENCODE_TEMPERATURE', async () => {
    vi.stubEnv('OPENCODE_BASE_URL', 'https://gateway.example/v1/');
    vi.stubEnv('OPENCODE_TEMPERATURE', '0.7');

    await openCodeComplete('p', { model: 'glm-5.2' });

    const { url, body } = capturedFetch();
    expect(url).toBe('https://gateway.example/v1/chat/completions');
    expect(body['temperature']).toBe(0.7);
  });

  it('includes a system message and max_tokens when provided', async () => {
    await openCodeComplete('p', { model: 'glm-5.2', system: 'be terse', maxTokens: 32 });

    const { body } = capturedFetch();
    expect(body['messages']).toEqual([
      { role: 'system', content: 'be terse' },
      { role: 'user', content: 'p' },
    ]);
    expect(body['max_tokens']).toBe(32);
  });

  it('maps text and usage onto LlmProviderResult', async () => {
    const result = await openCodeComplete('p', { model: 'glm-5.2' });

    expect(result).toMatchObject({
      text: 'oc-response',
      providerId: 'opencode',
      model: 'glm-5.2',
      promptTokens: 9,
      completionTokens: 4,
    });
    expect(Number.isInteger(result.durationMs)).toBe(true);
  });

  it('reports processing prompt then completed with completion tokens', async () => {
    const onProgress = vi.fn();

    await openCodeComplete('p', { model: 'glm-5.2', onProgress });

    expect(onProgress.mock.calls).toEqual([
      [{ status: 'processing prompt' }],
      [{ status: 'completed', completionTokens: 4 }],
    ]);
  });

  it('includes the response body in the failure message when present', async () => {
    fetchMock.mockResolvedValue(new Response('quota exceeded', { status: 429 }));

    await expect(openCodeComplete('p', { model: 'glm-5.2' })).rejects.toThrow(
      'OpenCode request failed: 429 quota exceeded',
    );
  });

  it('omits the body from the failure message when empty', async () => {
    fetchMock.mockResolvedValue(new Response('', { status: 503 }));

    await expect(openCodeComplete('p', { model: 'glm-5.2' })).rejects.toThrow('OpenCode request failed: 503');
  });

  it('throws when the response has no message content', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 }));

    await expect(openCodeComplete('p', { model: 'glm-5.2' })).rejects.toThrow(
      'Unexpected response from OpenCode',
    );
  });
});

const SSE_CHUNK_FIXTURE = [
  'data: {"id":"c1","object":"chat.completion.chunk","created":1,"model":"glm-5.2","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}',
  '',
  'data: {"id":"c1","object":"chat.completion.chunk","created":1,"model":"glm-5.2","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}',
  '',
  'data: {"id":"c1","object":"chat.completion.chunk","created":1,"model":"glm-5.2","choices":[{"index":0,"delta":{"content":" world"},"finish_reason":null}]}',
  '',
  'data: {"id":"c1","object":"chat.completion.chunk","created":1,"model":"glm-5.2","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":3,"completion_tokens":2,"total_tokens":5}}',
  '',
  'data: [DONE]',
  '',
  '',
].join('\n');

// Real streaming since migration phase A3 — this supersedes the A0 single-chunk pseudo-stream
// test (the sanctioned exception recorded in the migration ledger).
describe('openCodeStream', () => {
  it('yields streamed text deltas in order from an SSE response', async () => {
    fetchMock.mockResolvedValue(
      new Response(SSE_CHUNK_FIXTURE, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    );

    const chunks: string[] = [];
    for await (const chunk of openCodeStream('p', { model: 'glm-5.2' })) chunks.push(chunk);

    expect(chunks).toEqual(['Hello', ' world']);
    const { body } = capturedFetch();
    expect(body['stream']).toBe(true);
  });

  it('throws the mapped transport error when the stream request fails', async () => {
    fetchMock.mockResolvedValue(new Response('upstream down', { status: 503 }));

    const consume = async () => {
      const chunks: string[] = [];
      for await (const chunk of openCodeStream('p', { model: 'glm-5.2' })) chunks.push(chunk);
      return chunks;
    };

    await expect(consume()).rejects.toThrow('OpenCode request failed: 503 upstream down');
  });

  it('throws before any fetch when OPENCODE_API_KEY is missing', async () => {
    vi.stubEnv('OPENCODE_API_KEY', undefined);

    const consume = async () => {
      for await (const chunk of openCodeStream('p', { model: 'glm-5.2' })) void chunk;
    };

    await expect(consume()).rejects.toThrow('OPENCODE_API_KEY is not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('openCodeProvider.isAvailable', () => {
  it('is true when OPENCODE_API_KEY is set and false otherwise', async () => {
    expect(await openCodeProvider.isAvailable()).toBe(true);

    vi.stubEnv('OPENCODE_API_KEY', undefined);
    expect(await openCodeProvider.isAvailable()).toBe(false);
  });
});
