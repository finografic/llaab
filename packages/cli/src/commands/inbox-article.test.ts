import { createHermesInboxReceipt, createHermesInboxToolCall, routeHermesInboxText } from '@llaab/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { executeInboxToolCall } from './inbox.js';

interface RecordedCall {
  path: string;
  body: Record<string, unknown>;
}

/** Records every API call in order so capture-before-ingest can be asserted. */
function stubApi(responses: Array<{ ok: boolean; status?: number; json: Record<string, unknown> }>) {
  const calls: RecordedCall[] = [];
  let index = 0;

  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: { body?: string }) => {
      calls.push({
        path: new URL(url).pathname,
        body: JSON.parse(init?.body ?? '{}') as Record<string, unknown>,
      });

      const response = responses[index] ?? responses.at(-1);
      index += 1;

      return {
        ok: response?.ok ?? true,
        status: response?.status ?? (response?.ok === false ? 500 : 200),
        text: async () => JSON.stringify(response?.json ?? {}),
      };
    }),
  );

  return calls;
}

describe('docs:/post: inbox execution', () => {
  beforeEach(() => {
    process.env['LLAAB_API_KEY'] = 'test-key';
    process.env['LLAAB_API_URL'] = 'http://localhost:8888';
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env['LLAAB_API_KEY'];
    delete process.env['LLAAB_API_URL'];
  });

  it('writes the inbox capture before ingesting, and passes it as provenance', async () => {
    const calls = stubApi([
      { ok: true, json: { id: 'idea.docs-capture' } },
      {
        ok: true,
        json: {
          success: true,
          result: { id: 'vite-installation', title: 'Vite Installation', reused: false },
        },
      },
    ]);

    const route = routeHermesInboxText('docs: https://ui.shadcn.com/docs/installation/vite');
    const result = await executeInboxToolCall(createHermesInboxToolCall(route));

    expect(calls.map((call) => call.path)).toEqual(['/api/vault/nodes', '/api/ingest/article']);
    expect(calls[0]?.body).toMatchObject({ type: 'idea' });
    expect(calls[1]?.body).toMatchObject({
      url: 'https://ui.shadcn.com/docs/installation/vite',
      inboxCaptureId: 'idea.docs-capture',
    });

    expect(result).toMatchObject({
      status: 'saved',
      target_id: 'vite-installation',
      target_label: 'Vite Installation',
    });
    expect(createHermesInboxReceipt(route, result).text).toBe('✅ Ingested article: Vite Installation');
  });

  it('reports a reused article without creating a second one', async () => {
    stubApi([
      { ok: true, json: { id: 'idea.post-capture' } },
      { ok: true, json: { success: true, result: { id: 'tutorial', title: 'Tutorial', reused: true } } },
    ]);

    const route = routeHermesInboxText('post: https://example.com/tutorial');
    const result = await executeInboxToolCall(createHermesInboxToolCall(route));

    expect(result.target_label).toBe('Tutorial (reused existing article)');
  });

  it('keeps the inbox capture when the fetch fails, and says so in the receipt', async () => {
    const calls = stubApi([
      { ok: true, json: { id: 'idea.post-capture' } },
      { ok: false, status: 500, json: { error: 'not_readable' } },
    ]);

    const route = routeHermesInboxText('post: https://spa.example.com/');
    const result = await executeInboxToolCall(createHermesInboxToolCall(route));

    // The capture landed first, so the operator's link survives the failed ingest.
    expect(calls[0]?.path).toBe('/api/vault/nodes');
    expect(result).toMatchObject({ status: 'failed', error: 'not_readable' });
    expect(createHermesInboxReceipt(route, result).text).toBe(
      '❌ Failed article ingest (link kept in inbox): not_readable',
    );
  });

  it('does not attempt an ingest when the inbox capture itself fails', async () => {
    const calls = stubApi([{ ok: false, status: 500, json: { error: 'vault unavailable' } }]);

    const route = routeHermesInboxText('docs: https://example.com/guide');
    const result = await executeInboxToolCall(createHermesInboxToolCall(route));

    expect(calls.map((call) => call.path)).toEqual(['/api/vault/nodes']);
    expect(result.status).toBe('failed');
    expect(result.error).toContain('inbox capture failed before ingest');
  });

  it('leaves an unprefixed link as a capture with no ingest call', async () => {
    const calls = stubApi([{ ok: true, json: { id: 'idea.web-link' } }]);

    const route = routeHermesInboxText('https://example.com/some-article');
    const result = await executeInboxToolCall(createHermesInboxToolCall(route));

    expect(calls.map((call) => call.path)).toEqual(['/api/vault/nodes']);
    expect(result.status).toBe('saved');
    expect(createHermesInboxReceipt(route, result).text).toContain('Saved link');
  });
});
