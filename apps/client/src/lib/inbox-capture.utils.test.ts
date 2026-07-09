import { describe, expect, it } from 'vitest';
import type { LabNode } from '@llaab/schemas';

import { filterInboxCaptures, parseInboxFiltersFromSearchParams } from './inbox-capture-filters';
import { isInboxCaptureNode, parseInboxCapture } from './inbox-capture.utils';
import { getInboxReviewState, withInboxReviewState } from './inbox-review.utils';

function ideaNode(partial: Partial<LabNode> & Pick<LabNode, 'id' | 'title' | 'tags' | 'body'>): LabNode {
  return {
    type: 'idea',
    status: 'seed',
    related: [],
    created_at: '2026-07-09T00:00:00Z',
    updated_at: '2026-07-09T00:00:00Z',
    origin: 'manual',
    ...partial,
  } as LabNode;
}

describe('inbox capture parsing', () => {
  it('parses hermes body JSON provenance', () => {
    const node = ideaNode({
      id: 'docs-link-example',
      title: 'Docs link: example.com',
      tags: ['hermes', 'inbox', 'inbox:link', 'inbox:docs'],
      body: [
        '# Hermes Inbox Item',
        '',
        'https://example.com/docs',
        '',
        '```json',
        JSON.stringify({
          route_kind: 'docs_link',
          source: { platform: 'telegram', message_id: '1' },
          payload: { url: 'https://example.com/docs' },
        }),
        '```',
      ].join('\n'),
    });

    expect(isInboxCaptureNode(node)).toBe(true);
    const capture = parseInboxCapture(node);
    expect(capture.routeKind).toBe('docs_link');
    expect(capture.platform).toBe('telegram');
    expect(capture.malformed).toBe(false);
    expect(capture.rawText).toContain('https://example.com/docs');
  });

  it('falls back safely for malformed provenance JSON', () => {
    const node = ideaNode({
      id: 'broken',
      title: 'Broken',
      tags: ['hermes', 'inbox'],
      body: '# Hermes Inbox Item\n\n```json\n{not-json\n```',
    });

    const capture = parseInboxCapture(node);
    expect(capture.malformed).toBe(true);
    expect(capture.routeKind).toBe('unknown');
  });
});

describe('inbox review tags', () => {
  it('tracks reviewed and archived states', () => {
    const tags = withInboxReviewState(['hermes', 'inbox'], 'reviewed');
    expect(getInboxReviewState(ideaNode({ id: 'a', title: 'a', tags, body: '' }))).toBe('reviewed');
    const archived = withInboxReviewState(tags, 'archived');
    expect(archived).toContain('inbox:archived');
    expect(archived).not.toContain('inbox:reviewed');
  });
});

describe('inbox filters', () => {
  it('parses URL search params and filters by route kind', () => {
    const filters = parseInboxFiltersFromSearchParams(
      new URLSearchParams('kind=todo&attention=needs_attention'),
    );
    expect(filters.routeKind).toBe('todo');
    expect(filters.attention).toBe('needs_attention');

    const captures = [
      parseInboxCapture(
        ideaNode({
          id: 'todo-1',
          title: 'Todo: one',
          tags: ['hermes', 'inbox', 'inbox:todo'],
          body: [
            '# Hermes Inbox Item',
            '',
            'buy milk',
            '',
            '```json',
            JSON.stringify({ route_kind: 'todo', source: { platform: 'telegram' }, payload: {} }),
            '```',
          ].join('\n'),
        }),
      ),
      parseInboxCapture(
        ideaNode({
          id: 'link-1',
          title: 'Link',
          tags: ['hermes', 'inbox', 'inbox:link'],
          body: [
            '# Hermes Inbox Item',
            '',
            '```json',
            JSON.stringify({
              route_kind: 'web_link',
              source: { platform: 'manual' },
              payload: { url: 'https://example.com' },
            }),
            '```',
          ].join('\n'),
        }),
      ),
    ];

    const filtered = filterInboxCaptures(captures, { ...filters, routeKind: 'todo' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.node.id).toBe('todo-1');
  });
});
