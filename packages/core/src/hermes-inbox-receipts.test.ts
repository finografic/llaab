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

  it('maps npm package routes to the package pin tool', () => {
    const route = routeHermesInboxText('https://www.npmjs.com/package/zod');

    expect(createHermesInboxToolCall(route)).toEqual({
      name: 'vault_pin_package',
      arguments: { name: 'zod' },
    });
  });

  it('maps GitHub repository routes to the repository pin tool', () => {
    const item = {
      raw_text: 'https://github.com/finografic/LLAAB',
      attachments: [],
      source: {
        platform: 'telegram' as const,
        chat_id: 'chat-1',
        message_id: 'message-2',
      },
    };
    const route = routeHermesInboxText(item.raw_text);

    expect(createHermesInboxToolCall(route, item)).toEqual({
      name: 'vault_pin_repository',
      arguments: {
        fullName: 'finografic/LLAAB',
        route_kind: 'github_repo',
        source: item.source,
        payload: {
          owner: 'finografic',
          repo: 'LLAAB',
          url: 'https://github.com/finografic/LLAAB',
        },
      },
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
        route_kind: 'image',
      },
    });
  });

  it('preserves code image labels in attachment tool calls', () => {
    const item = {
      raw_text: 'code: shadcn card screenshot',
      attachments: [{ kind: 'image' as const, file_name: 'screen.png', mime_type: 'image/png' }],
      source: { platform: 'telegram' as const },
    };
    const route = routeHermesInboxItem(item);

    expect(createHermesInboxToolCall(route, item)).toMatchObject({
      name: 'vault_capture_attachment',
      arguments: {
        route_kind: 'code_attachment',
        payload: {
          label: 'shadcn card screenshot',
          attachment: {
            kind: 'image',
            file_name: 'screen.png',
            mime_type: 'image/png',
          },
        },
      },
    });
  });

  it('formats image attachment receipts distinctly from other attachments', () => {
    const imageRoute = routeHermesInboxItem({
      attachments: [{ kind: 'image', file_name: 'screen.png', mime_type: 'image/png' }],
      source: { platform: 'telegram' },
    });

    expect(createHermesInboxReceipt(imageRoute, { status: 'saved', target_id: 'idea.inbox-image' })).toEqual({
      status: 'saved',
      text: '✅ Saved image: idea.inbox-image',
    });
  });

  it('formats docs attachment receipts distinctly from other attachments', () => {
    const docsRoute = routeHermesInboxItem({
      raw_text: 'docs: shadcn vite setup',
      attachments: [{ kind: 'file', file_name: 'INBOX.md', mime_type: 'text/markdown' }],
      source: { platform: 'telegram' },
    });

    expect(createHermesInboxReceipt(docsRoute, { status: 'saved', target_id: 'idea.inbox-docs' })).toEqual({
      status: 'saved',
      text: '✅ Saved docs attachment: idea.inbox-docs',
    });
  });

  it('formats code image receipts as code snippets', () => {
    const codeImageRoute = routeHermesInboxItem({
      raw_text: 'code: shadcn card screenshot',
      attachments: [{ kind: 'image', file_name: 'screen.png', mime_type: 'image/png' }],
      source: { platform: 'telegram' },
    });

    expect(createHermesInboxReceipt(codeImageRoute, { status: 'saved', target_id: 'idea.code' })).toEqual({
      status: 'saved',
      text: '✅ Saved code snippet: idea.code',
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

  it('formats GitHub repository pin receipts', () => {
    const githubRoute = routeHermesInboxText('https://github.com/finografic/LLAAB');

    expect(
      createHermesInboxReceipt(githubRoute, { status: 'pinned', target_label: 'finografic/LLAAB' }),
    ).toEqual({
      status: 'pinned',
      text: '✅ Pinned GitHub repo: finografic/LLAAB',
    });
  });

  it('formats route-specific web link receipts', () => {
    const genericRoute = routeHermesInboxText('https://example.com/some-article');

    expect(createHermesInboxReceipt(genericRoute, { status: 'saved', target_id: 'idea.web-link' })).toEqual({
      status: 'saved',
      text: '✅ Saved link: idea.web-link',
    });
  });

  it('reports a docs/post ingest using the fetched article title', () => {
    const docsRoute = routeHermesInboxText('docs: https://ui.shadcn.com/docs/installation/vite');

    expect(
      createHermesInboxReceipt(docsRoute, {
        status: 'saved',
        target_id: 'vite-installation',
        target_label: 'Vite Installation',
      }),
    ).toEqual({
      status: 'saved',
      text: '✅ Ingested article: Vite Installation',
    });
  });

  it('says the link was kept when an article ingest fails', () => {
    const postRoute = routeHermesInboxText('post: https://example.com/tutorial');

    expect(createHermesInboxReceipt(postRoute, { status: 'failed', error: 'not_readable' })).toEqual({
      status: 'failed',
      text: '❌ Failed article ingest (link kept in inbox): not_readable',
    });
  });

  it('builds a vault_ingest_article tool call carrying the link and provenance', () => {
    const docsRoute = routeHermesInboxText('docs: https://ui.shadcn.com/docs/installation/vite');

    expect(createHermesInboxToolCall(docsRoute)).toMatchObject({
      name: 'vault_ingest_article',
      arguments: {
        url: 'https://ui.shadcn.com/docs/installation/vite',
        kind: 'docs_link',
        tags: ['hermes', 'inbox'],
      },
    });
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
