import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Characterization tests for the Anthropic provider transport (Fable migration A0). Mocked at
 * the HTTP boundary (global fetch) rather than the SDK so the pinned wire shapes survived the
 * A2 swap from @anthropic-ai/sdk to @ai-sdk/anthropic. Error fixtures use status 400 — retrying
 * SDKs treat 408/429/5xx as retryable with real-timer backoff.
 */

const fetchMock = vi.fn();

beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function importAnthropic() {
  return import('./anthropic.js');
}

interface MessageFixtureOverrides {
  content?: unknown[];
  usage?: Record<string, number>;
}

function messageResponse(overrides: MessageFixtureOverrides = {}): Response {
  return new Response(
    JSON.stringify({
      id: 'msg_test',
      type: 'message',
      role: 'assistant',
      model: 'claude-x',
      content: overrides.content ?? [{ type: 'text', text: 'hello from claude' }],
      stop_reason: 'end_turn',
      stop_sequence: null,
      usage: overrides.usage ?? { input_tokens: 10, output_tokens: 5 },
    }),
    { status: 200, headers: { 'content-type': 'application/json' } },
  );
}

/**
 * The Anthropic API accepts prompt text either as a plain string or as an array of text blocks;
 *
 * @anthropic-ai/sdk sent strings, @ai-sdk/anthropic sends block arrays. Both are canonical —
 * assert the joined text so the pin survives the transport swap (recorded in the migration
 * ledger under Decisions).
 */
function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((block) => (block as { text?: string }).text ?? '').join('');
  }
  return '';
}

async function capturedRequest(
  index = 0,
): Promise<{ url: string; method: string; body: Record<string, unknown> }> {
  const call = fetchMock.mock.calls[index] as [unknown, RequestInit | undefined];
  const [input, init] = call;
  if (input instanceof Request) {
    return {
      url: input.url,
      method: input.method,
      body: JSON.parse(await input.clone().text()) as Record<string, unknown>,
    };
  }
  return {
    url: String(input),
    method: init?.method ?? 'GET',
    body: JSON.parse((init?.body ?? '') as string) as Record<string, unknown>,
  };
}

const SSE_FIXTURE = [
  'event: message_start',
  'data: {"type":"message_start","message":{"id":"msg_test","type":"message","role":"assistant","content":[],"model":"claude-x","stop_reason":null,"stop_sequence":null,"usage":{"input_tokens":3,"output_tokens":1}}}',
  '',
  'event: content_block_start',
  'data: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello"}}',
  '',
  'event: content_block_delta',
  'data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" world"}}',
  '',
  'event: content_block_stop',
  'data: {"type":"content_block_stop","index":0}',
  '',
  'event: message_delta',
  'data: {"type":"message_delta","delta":{"stop_reason":"end_turn","stop_sequence":null},"usage":{"output_tokens":2}}',
  '',
  'event: message_stop',
  'data: {"type":"message_stop"}',
  '',
  '',
].join('\n');

describe('anthropicComplete', () => {
  it('POSTs /v1/messages with model, max_tokens default 1024, and a single user message', async () => {
    const { anthropicComplete } = await importAnthropic();
    fetchMock.mockResolvedValue(messageResponse());

    await anthropicComplete('the prompt', { model: 'claude-x' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const request = await capturedRequest();
    expect(request.url).toBe('https://api.anthropic.com/v1/messages');
    expect(request.method).toBe('POST');
    expect(request.body['model']).toBe('claude-x');
    expect(request.body['max_tokens']).toBe(1024);
    const messages = request.body['messages'] as Array<{ role: string; content: unknown }>;
    expect(messages).toHaveLength(1);
    expect(messages[0]?.role).toBe('user');
    expect(textOf(messages[0]?.content)).toBe('the prompt');
    expect(request.body).not.toHaveProperty('system');
  });

  it('passes maxTokens and system through as max_tokens and top-level system', async () => {
    const { anthropicComplete } = await importAnthropic();
    fetchMock.mockResolvedValue(messageResponse());

    await anthropicComplete('p', { model: 'claude-x', maxTokens: 7, system: 'be terse' });

    const request = await capturedRequest();
    expect(request.body['max_tokens']).toBe(7);
    expect(textOf(request.body['system'])).toBe('be terse');
  });

  it('maps text and usage onto LlmProviderResult', async () => {
    const { anthropicComplete } = await importAnthropic();
    fetchMock.mockResolvedValue(messageResponse());

    const result = await anthropicComplete('p', { model: 'claude-x' });

    expect(result).toMatchObject({
      text: 'hello from claude',
      providerId: 'anthropic',
      model: 'claude-x',
      promptTokens: 10,
      completionTokens: 5,
    });
    expect(Number.isInteger(result.durationMs)).toBe(true);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('throws when the first content block is not text', async () => {
    const { anthropicComplete } = await importAnthropic();
    fetchMock.mockResolvedValue(
      messageResponse({ content: [{ type: 'tool_use', id: 'tu_1', name: 'tool', input: {} }] }),
    );

    await expect(anthropicComplete('p', { model: 'claude-x' })).rejects.toThrow(
      'Unexpected response type from Anthropic',
    );
  });

  it('propagates HTTP errors from the SDK', async () => {
    const { anthropicComplete } = await importAnthropic();
    fetchMock.mockResolvedValue(
      new Response(
        JSON.stringify({ type: 'error', error: { type: 'invalid_request_error', message: 'bad request' } }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(anthropicComplete('p', { model: 'claude-x' })).rejects.toThrow(/400|bad request/);
  });
});

describe('anthropicStream', () => {
  it('requests a stream and yields only text deltas in order', async () => {
    const { anthropicStream } = await importAnthropic();
    fetchMock.mockResolvedValue(
      new Response(SSE_FIXTURE, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    );

    const chunks: string[] = [];
    for await (const chunk of anthropicStream('p', { model: 'claude-x' })) chunks.push(chunk);

    expect(chunks).toEqual(['Hello', ' world']);
    const request = await capturedRequest();
    expect(request.body['stream']).toBe(true);
    expect(request.body['max_tokens']).toBe(1024);
  });
});

describe('anthropicProvider.isAvailable', () => {
  it('is true when ANTHROPIC_API_KEY is set and false otherwise', async () => {
    const { anthropicProvider } = await importAnthropic();
    expect(await anthropicProvider.isAvailable()).toBe(true);

    vi.stubEnv('ANTHROPIC_API_KEY', undefined);
    expect(await anthropicProvider.isAvailable()).toBe(false);
  });
});
