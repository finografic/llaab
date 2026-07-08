import { describe, expect, it } from 'vitest';

import {
  createHermesInboxLogEvent,
  createHermesInboxReceipt,
  createHermesInboxToolCall,
} from './hermes-inbox-receipts.js';
import { routeHermesInboxItem, routeHermesInboxText } from './hermes-inbox-router.js';

describe('createHermesInboxToolCall', () => {
  it('maps YouTube routes to the YouTube ingest tool', () => {
    const route = routeHermesInboxText('https://youtu.be/abc123');

    expect(createHermesInboxToolCall(route)).toEqual({
      name: 'vault_ingest_youtube',
      arguments: {
        url: 'https://youtu.be/abc123',
        tags: ['hermes', 'inbox'],
      },
    });
  });

  it('maps npm package routes to the library pin tool', () => {
    const route = routeHermesInboxText('https://www.npmjs.com/package/zod');

    expect(createHermesInboxToolCall(route)).toEqual({
      name: 'vault_pin_library',
      arguments: { name: 'zod' },
    });
  });

  it('maps command candidates to safe raw inbox capture', () => {
    const route = routeHermesInboxText('npx shadcn@latest add button');

    expect(createHermesInboxToolCall(route)).toMatchObject({
      name: 'vault_capture_inbox',
      arguments: {
        raw_text: 'npx shadcn@latest add button',
        route_kind: 'command_candidate',
      },
    });
  });

  it('preserves attachment captions in attachment tool calls', () => {
    const item = {
      raw_text: 'caption from telegram',
      attachments: [{ kind: 'image' as const, file_name: 'screen.png', mime_type: 'image/png' }],
      source: { platform: 'telegram' as const },
    };
    const route = routeHermesInboxItem(item);

    expect(createHermesInboxToolCall(route, item)).toMatchObject({
      name: 'vault_capture_attachment',
      arguments: {
        attachment: {
          kind: 'image',
          file_name: 'screen.png',
          mime_type: 'image/png',
        },
        raw_text: 'caption from telegram',
      },
    });
  });
});

describe('createHermesInboxReceipt', () => {
  it('formats short success receipts', () => {
    const route = routeHermesInboxText('todo: test receipts');

    expect(createHermesInboxReceipt(route, { status: 'captured', target_id: 'idea.test-receipts' })).toEqual({
      status: 'captured',
      text: '✅ Captured todo: idea.test-receipts',
    });
  });

  it('formats short failure receipts without requiring an API key', () => {
    const route = routeHermesInboxText('https://youtu.be/abc123');

    expect(createHermesInboxReceipt(route, { status: 'failed', error: 'LLAAB_API_KEY is required' })).toEqual(
      {
        status: 'failed',
        text: '❌ Failed YouTube ingest: LLAAB_API_KEY is required',
      },
    );
  });
});

describe('createHermesInboxLogEvent', () => {
  it('keeps route, tool call, receipt, and failure details together', () => {
    const route = routeHermesInboxText('https://example.com/docs');
    const toolCall = createHermesInboxToolCall(route);
    const receipt = createHermesInboxReceipt(route, { status: 'failed', error: 'missing key' });

    expect(
      createHermesInboxLogEvent({
        route,
        toolCall,
        receipt,
        result: { status: 'failed', error: 'missing key' },
      }),
    ).toMatchObject({
      event: 'hermes_inbox_route',
      tool_call: { name: 'vault_capture_web_link' },
      receipt: { text: '❌ Failed link capture: missing key' },
      status: 'failed',
      error: 'missing key',
    });
  });
});
