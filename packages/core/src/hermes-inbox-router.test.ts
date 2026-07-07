import { describe, expect, it } from 'vitest';

import { routeHermesInboxItem, routeHermesInboxText } from './hermes-inbox-router.js';

describe('routeHermesInboxText', () => {
  it('routes YouTube watch URLs to ingestion', () => {
    expect(routeHermesInboxText('https://www.youtube.com/watch?v=abc123').payload).toMatchObject({
      url: 'https://www.youtube.com/watch?v=abc123',
      video_id: 'abc123',
    });
    expect(routeHermesInboxText('https://www.youtube.com/watch?v=abc123').action).toBe('ingest_youtube');
  });

  it('routes short YouTube URLs to ingestion', () => {
    expect(routeHermesInboxText('https://youtu.be/abc123?t=10')).toMatchObject({
      kind: 'youtube_url',
      action: 'ingest_youtube',
      payload: {
        url: 'https://youtu.be/abc123?t=10',
        video_id: 'abc123',
      },
    });
  });

  it('routes npm package URLs to library pinning', () => {
    expect(routeHermesInboxText('https://www.npmjs.com/package/@modelcontextprotocol/sdk')).toMatchObject({
      kind: 'npm_package',
      action: 'pin_library',
      payload: {
        package_name: '@modelcontextprotocol/sdk',
        url: 'https://www.npmjs.com/package/@modelcontextprotocol/sdk',
      },
    });
  });

  it('routes npx and npmx notes as command candidates', () => {
    expect(routeHermesInboxText('npx shadcn@latest add button')).toMatchObject({
      kind: 'command_candidate',
      action: 'capture_command_candidate',
      payload: { command: 'npx shadcn@latest add button' },
    });

    expect(routeHermesInboxText('npmx vite')).toMatchObject({
      kind: 'command_candidate',
      action: 'capture_command_candidate',
      payload: { command: 'npmx vite' },
    });
  });

  it('routes todo-prefixed notes as todos', () => {
    expect(routeHermesInboxText('todo: wire Hermes dropbox')).toMatchObject({
      kind: 'todo',
      action: 'capture_todo',
      payload: { text: 'wire Hermes dropbox' },
    });
  });

  it('routes GitHub repo URLs as web links with repo metadata', () => {
    expect(routeHermesInboxText('https://github.com/finografic/LLAAB')).toMatchObject({
      kind: 'github_repo',
      action: 'capture_web_link',
      payload: {
        owner: 'finografic',
        repo: 'LLAAB',
        url: 'https://github.com/finografic/LLAAB',
      },
    });
  });

  it('routes generic URLs as web links', () => {
    expect(routeHermesInboxText('https://example.com/docs')).toMatchObject({
      kind: 'web_link',
      action: 'capture_web_link',
      payload: { url: 'https://example.com/docs' },
    });
  });

  it('falls back to raw capture for unknown text', () => {
    expect(routeHermesInboxText('remember this later')).toMatchObject({
      kind: 'raw',
      action: 'capture_raw',
      payload: { text: 'remember this later' },
    });
  });
});

describe('routeHermesInboxItem', () => {
  it('routes attachments when text is absent', () => {
    expect(
      routeHermesInboxItem({
        attachments: [
          {
            kind: 'image',
            file_name: 'screenshot.png',
            mime_type: 'image/png',
            local_path: '/tmp/screenshot.png',
          },
        ],
        source: { platform: 'telegram' },
      }),
    ).toMatchObject({
      kind: 'attachment',
      action: 'capture_attachment',
      payload: {
        attachment: {
          kind: 'image',
          file_name: 'screenshot.png',
          mime_type: 'image/png',
          local_path: '/tmp/screenshot.png',
        },
      },
    });
  });

  it('prefers attachment capture when captions are unstructured', () => {
    expect(
      routeHermesInboxItem({
        raw_text: 'screenshot from the error',
        attachments: [{ kind: 'image', file_name: 'error.png', mime_type: 'image/png' }],
        source: { platform: 'telegram' },
      }),
    ).toMatchObject({
      kind: 'attachment',
      action: 'capture_attachment',
      payload: {
        raw_text: 'screenshot from the error',
        attachment: {
          kind: 'image',
          file_name: 'error.png',
          mime_type: 'image/png',
        },
      },
    });
  });
});
