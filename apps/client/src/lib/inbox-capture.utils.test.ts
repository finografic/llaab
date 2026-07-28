import { describe, expect, it } from 'vitest';
import type { LabNode } from '@llaab/schemas';

import {
  filterInboxCaptures,
  inboxCaptureNeedsAttention,
  matchesInboxCaptureView,
  parseInboxFiltersFromSearchParams,
  reviewStateToScope,
  scopeToReviewState,
} from './inbox-capture-filters';
import { isInboxCaptureNode, parseInboxCapture } from './inbox-capture.utils';
import { getInboxReviewState, withInboxReviewState } from './inbox-review.utils';

function ideaNode(partial: Partial<LabNode> & Pick<LabNode, 'id' | 'title' | 'tags' | 'body'>): LabNode {
  return {
    type: 'idea',
    status: 'seed',
    related: [],
    created_at: '2026-07-20T00:00:00Z',
    updated_at: '2026-07-20T00:00:00Z',
    origin: 'manual',
    ...partial,
  } as LabNode;
}

function transcriptNode(
  partial: Partial<LabNode> & Pick<LabNode, 'id' | 'title' | 'tags' | 'body'>,
): LabNode {
  return {
    type: 'transcript',
    status: 'seed',
    related: [],
    created_at: '2026-07-20T00:00:00Z',
    updated_at: '2026-07-20T00:00:00Z',
    origin: 'youtube',
    source_id: 'source.youtube-example',
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

  it('treats Hermes inbox transcript nodes as YouTube captures', () => {
    const node = transcriptNode({
      id: 'transcript.youtube-example',
      title: 'Claude Code Dynamic Workflows Clearly Explained',
      tags: ['hermes', 'inbox'],
      body: '# Claude Code Dynamic Workflows Clearly Explained',
    });

    expect(isInboxCaptureNode(node)).toBe(true);
    const capture = parseInboxCapture(node);
    expect(capture.routeKind).toBe('youtube_url');
    expect(matchesInboxCaptureView(capture, 'action_backed')).toBe(true);
  });

  it('ignores generated ideas that only inherited broad Hermes inbox tags', () => {
    const node = ideaNode({
      id: 'idea.extracted-from-hermes-transcript',
      title: 'Workflows can consume massive input tokens',
      tags: ['hermes', 'inbox', 'd:ingest', 'd:llm'],
      body: 'Generated idea from transcript extraction, not a Hermes inbox receipt.',
    });

    expect(isInboxCaptureNode(node)).toBe(false);
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
    const filters = parseInboxFiltersFromSearchParams(new URLSearchParams('kind=todo'));
    expect(filters.routeKind).toBe('todo');
    expect(
      parseInboxFiltersFromSearchParams(new URLSearchParams('attention=needs_attention')).attention,
    ).toBe('needs_attention');

    const captures = [
      parseInboxCapture(
        ideaNode({
          id: 'todo-1',
          title: 'Todo: one',
          // A *fresh* unreviewed todo needs no attention. Pinning a literal date made this assert a
          // wall-clock coincidence instead, and it silently began failing once the fixture aged past
          // the 7-day threshold.
          created_at: new Date().toISOString(),
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
    expect(matchesInboxCaptureView(captures[0], 'todos')).toBe(true);
    expect(matchesInboxCaptureView(captures[1], 'links')).toBe(true);
    expect(inboxCaptureNeedsAttention(captures[0])).toBe(false);
  });

  it('preserves a valid saved view and rejects an unknown view', () => {
    expect(parseInboxFiltersFromSearchParams(new URLSearchParams('view=attachments')).view).toBe(
      'attachments',
    );
    expect(parseInboxFiltersFromSearchParams(new URLSearchParams('view=missing')).view).toBe('all');
  });

  it('maps review scope helpers without using a second All label', () => {
    expect(reviewStateToScope('new')).toBe('unreviewed');
    expect(reviewStateToScope('reviewed')).toBe('reviewed');
    expect(reviewStateToScope('all')).toBe('both');
    expect(reviewStateToScope('archived')).toBe('');
    expect(scopeToReviewState('unreviewed')).toBe('new');
    expect(scopeToReviewState('reviewed')).toBe('reviewed');
    expect(scopeToReviewState('both')).toBe('all');
  });

  it('still parses legacy review=failed from the URL but does not offer failed attention', () => {
    expect(parseInboxFiltersFromSearchParams(new URLSearchParams('review=failed')).reviewState).toBe(
      'failed',
    );
    expect(parseInboxFiltersFromSearchParams(new URLSearchParams('attention=failed')).attention).toBe('all');
  });
});
