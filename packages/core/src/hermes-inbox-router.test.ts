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

    expect(routeHermesInboxText('https://npmx.dev/package/zod')).toMatchObject({
      kind: 'npm_package',
      action: 'pin_library',
      payload: {
        package_name: 'zod',
        url: 'https://npmx.dev/package/zod',
      },
    });
  });

  it('routes package runner notes as command candidates', () => {
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

    expect(routeHermesInboxText('pnpm dlx shadcn@latest add button')).toMatchObject({
      kind: 'command_candidate',
      action: 'capture_command_candidate',
      payload: { command: 'pnpm dlx shadcn@latest add button' },
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

  it('routes explicit docs and post prefixes as distinct web links', () => {
    expect(routeHermesInboxText('docs: https://ui.shadcn.com/docs/installation/vite')).toMatchObject({
      kind: 'docs_link',
      action: 'capture_web_link',
      payload: {
        url: 'https://ui.shadcn.com/docs/installation/vite',
        label: 'https://ui.shadcn.com/docs/installation/vite',
      },
    });

    expect(routeHermesInboxText('post: https://example.com/tutorial')).toMatchObject({
      kind: 'post_link',
      action: 'capture_web_link',
      payload: {
        url: 'https://example.com/tutorial',
        label: 'https://example.com/tutorial',
      },
    });
  });

  it('routes code-prefixed GitHub blob and docs URLs as code links', () => {
    expect(
      routeHermesInboxText(
        'code: https://github.com/mattpocock/dictionary-of-ai-coding/blob/main/internal/generate-readme.ts',
      ),
    ).toMatchObject({
      kind: 'code_link',
      action: 'capture_web_link',
      payload: {
        owner: 'mattpocock',
        repo: 'dictionary-of-ai-coding',
        ref: 'main',
        file_path: 'internal/generate-readme.ts',
        language: 'typescript',
      },
    });

    expect(
      routeHermesInboxText('code: https://ui.shadcn.com/docs/installation/astro#add-components'),
    ).toMatchObject({
      kind: 'code_link',
      action: 'capture_web_link',
      payload: {
        url: 'https://ui.shadcn.com/docs/installation/astro#add-components',
        link_type: 'code_reference',
      },
    });
  });

  it('routes code-prefixed text and obvious JSX-like pastes as code snippets', () => {
    expect(routeHermesInboxText('code: const answer: number = 42;')).toMatchObject({
      kind: 'code_snippet',
      action: 'capture_raw',
      payload: {
        text: 'const answer: number = 42;',
        language: 'typescript',
      },
    });

    expect(routeHermesInboxText('<Layout><Card className="max-w-sm" /></Layout>')).toMatchObject({
      kind: 'code_snippet',
      action: 'capture_raw',
      payload: {
        language: 'tsx',
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
      kind: 'image',
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
      kind: 'image',
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

  it('preserves attachments even when text contains a generic URL', () => {
    expect(
      routeHermesInboxItem({
        raw_text: 'see https://ui.shadcn.com/docs/installation/vite',
        attachments: [{ kind: 'file', file_name: 'TEST.md', mime_type: 'text/markdown' }],
        source: { platform: 'telegram' },
      }),
    ).toMatchObject({
      kind: 'attachment',
      action: 'capture_attachment',
      payload: {
        raw_text: 'see https://ui.shadcn.com/docs/installation/vite',
        attachment: {
          kind: 'file',
          file_name: 'TEST.md',
          mime_type: 'text/markdown',
        },
      },
    });
  });

  it('routes docs-prefixed attachments as docs attachments', () => {
    expect(
      routeHermesInboxItem({
        raw_text: 'docs: shadcn vite setup',
        attachments: [{ kind: 'file', file_name: 'INBOX.md', mime_type: 'text/markdown' }],
        source: { platform: 'telegram' },
      }),
    ).toMatchObject({
      kind: 'docs_attachment',
      action: 'capture_attachment',
      payload: {
        raw_text: 'docs: shadcn vite setup',
        label: 'shadcn vite setup',
        attachment: {
          kind: 'file',
          file_name: 'INBOX.md',
          mime_type: 'text/markdown',
        },
      },
    });
  });

  it('routes code-prefixed and recognized code file attachments as code attachments', () => {
    expect(
      routeHermesInboxItem({
        raw_text: 'code: astro page index',
        attachments: [{ kind: 'file', file_name: 'index.astro', mime_type: 'text/plain' }],
        source: { platform: 'telegram' },
      }),
    ).toMatchObject({
      kind: 'code_attachment',
      action: 'capture_attachment',
      payload: {
        label: 'astro page index',
        language: 'astro',
        attachment: {
          file_name: 'index.astro',
        },
      },
    });

    expect(
      routeHermesInboxItem({
        attachments: [{ kind: 'file', file_name: 'component.jsx', mime_type: 'text/javascript' }],
        source: { platform: 'telegram' },
      }),
    ).toMatchObject({
      kind: 'code_attachment',
      action: 'capture_attachment',
      payload: {
        language: 'tsx',
      },
    });
  });

  it('routes attachments as docs when the docs caption follows extracted file text', () => {
    expect(
      routeHermesInboxItem({
        raw_text: [
          '[Content of TEST.md]:',
          '# shadcn - Add Components',
          'https://ui.shadcn.com/docs/installation/vite',
          '',
          'docs: test shadcn add components',
        ].join('\n'),
        attachments: [{ kind: 'file', file_name: 'TEST.md', mime_type: 'text/markdown' }],
        source: { platform: 'telegram' },
      }),
    ).toMatchObject({
      kind: 'docs_attachment',
      action: 'capture_attachment',
      payload: {
        label: 'test shadcn add components',
        attachment: {
          kind: 'file',
          file_name: 'TEST.md',
          mime_type: 'text/markdown',
        },
      },
    });
  });
});
